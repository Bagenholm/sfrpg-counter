Hooks.once('init', async function() {
    console.log('sfrpg-counter | SFRPG-counter active')
});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(SfrpgCounter.ID);
});

Hooks.on("renderTokenHUD", (...args) => SfrpgCounter.tokenIcon(...args));


Hooks.on('onBeforeUpdateCombat', (combatEventData) => {
    SfrpgCounterAutoUpdater.updateCombatCounters(combatEventData);
});

Hooks.on('onActorRest', (restEvent) => {
    SfrpgCounterAutoUpdater.updateRestCounters(restEvent);
}); 

Hooks.on('updateItem', (item, updateData, stuff) => {
    if(item.type == "actorResource") {
        SfrpgCounterAutoUpdater.updateResourceCounters(item, updateData);
    } else if(item.type == "feat") {
        SfrpgCounterAutoUpdater.updateFeatUsage(item, updateData);
    }
});

class SfrpgCounter {
    static ID = 'sfrpg-counter';
    static DEFAULT_ITEM_IMG = "icons/svg/mystery-man.svg";

    static FLAGS = {
        COUNTERS: 'counters'
    }

    static TEMPLATES = {
        COUNTERLIST : `modules/${this.ID}/templates/sfrpg-counter.hbs`,
        EDITCOUNTER : `modules/${this.ID}/templates/sfrpg-counter-edit.hbs` 
    }

    static log(force, ...args) {  
        const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

        if (shouldLog) {
            console.log(this.ID, '|', ...args);
        }
    }

    static initialize() {
        this.sfrpgCounterConfig = new SfrpgCounterConfig();
        this.sfrpgCounterEdit = new SfrpgCounterEdit();
    }

    /**
     * Renders both the config and edit windows.
     */
    static renderWindows() {
        this.sfrpgCounterConfig.render();
        this.sfrpgCounterEdit.render();
    }

    static tokenIcon(hud, html, token) {
        let counterButton = this.createButton();
        SfrpgCounter.log(false, 'Token Icon Click', token);

        var userId;
        //Checks if linked actor and sets actorId or token's unlinked id.
        if(!token.actorLink) {
            userId = token.id;
        } else {
            userId = token.actorId;
        }
        
        $(counterButton).click((event) => {
            SfrpgCounter.initialize();
            SfrpgCounter.sfrpgCounterConfig.render(true, {userId})});
 
        let tokenItems = html.find('div.right');
        tokenItems.append(counterButton);
    }

    static createButton() {
        let button = document.createElement("div");

		button.classList.add("control-icon");
        button.classList.add("counter-list-icon-button");
        button.title = game.i18n.localize('SFRPG-COUNTER.button-title');
        button.innerHTML = `<i class="fas fa-image fa-wave-square"></i>`;

        return button;
    }
}

class SfrpgCounterData {
    static getLinkedOrUnlinkedActor(actorId) {
        return game.actors.get(actorId) || canvas.tokens.get(actorId).document;
    }

    static getCountersForActor(actorId) {
        SfrpgCounter.log(false, 'Getting counters for actor', actorId, game.actors.get(actorId), canvas.tokens.get(actorId))
        
        //Linked or unlinked actor
        let actor = this.getLinkedOrUnlinkedActor(actorId);
        return actor.getFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS);
    }

    static getCounter(counterId) {
        return this.allCounters()[counterId];
    }

    static createCounter(actorId, counterData) {
        const newCounter = {
            id: foundry.utils.randomID(16),
            actorId,
            ...counterData,
        }

        const newCounters = {
            [newCounter.id]: newCounter
        }

        //Linked or unlinked actor
        let actor = this.getLinkedOrUnlinkedActor(actorId);
        return actor.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, newCounters)
    }

    static allCounters() {
        const linkedCounters = game.actors.reduce((accumulator, actor) => {
            const actorCounters = this.getCountersForActor(actor.id);

            return {
                ...accumulator,
                ...actorCounters
            }
        }, {});

        const unlinkedCounters = canvas.tokens.ownedTokens.reduce((accumulator, actor) => {
            const unlinkedActorCounters = this.getCountersForActor(actor.id);

            return {
                ...accumulator,
                ...unlinkedActorCounters
            }
        }, {});
        
        return {...linkedCounters, ...unlinkedCounters};
    }

    static async updateCounter(counterId, updateData, originalCounter, skipSync) {


        updateData = this.checkValueWithinRange(updateData);
        let currentCounter = originalCounter || this.allCounters()[counterId];
        
        const mergedCounter = foundry.utils.mergeObject(currentCounter, updateData);
        const update = {
            [counterId]: updateData
        }

        let actor = this.getLinkedOrUnlinkedActor(mergedCounter.actorId);

        if(mergedCounter.isItemAuto) {
            await SfrpgCounterAutoUpdater.updateFeatActivation(mergedCounter);
        }


        await actor.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, update)
        
        //if(mergedCounter.isSync) { TODO: change back to check whether it's synced
        if(true) {
           await this.syncActorFeatAndResource(mergedCounter, actor, counterId, updateData);
        }       

        //Renders here to make sure windows are rendered on autoUpdate
        SfrpgCounter.renderWindows();
        
        return;
    }

    static async syncActorFeatAndResource(mergedCounter, actor, counterId, updateData) {
        //Hacky solution. Shouldn't need to compare entities here. Deprecated, too! Just.. sheesh. Why would anyone let me code?
        let entityType = actor.entity;
        if(mergedCounter.isActorResource) {
            if(entityType == "Token") {
                return await actor._actor.setResourceBaseValue(mergedCounter.type, mergedCounter.subType, mergedCounter.value);
            } else if(entityType == "Actor"){
                return await game.actors.get(mergedCounter.actorId)?.setResourceBaseValue(mergedCounter.type, mergedCounter.subType, mergedCounter.value);
            }
        } else if(mergedCounter.hasCharges) {
            SfrpgCounter.log(false, 'Counter with charges', actor, mergedCounter)

            let featWithCharges; 
            if(entityType == "Actor") {
                featWithCharges = game.actors.get(mergedCounter.actorId).items.get(mergedCounter.itemId);
            } else if(entityType == "Token") {
                featWithCharges = actor.actor.items.get(mergedCounter.itemId)
            }
            let restType;

            if(mergedCounter.autoOn == "longRest") {
                restType = "lr";
            } else if(mergedCounter.autoOn == "shortRest") {
                restType = "sr";
            } else {
                restType = featWithCharges.data?.data?.uses?.per;
            }
            let itemUpdate = ({'data.uses.value': mergedCounter.value, 'data.uses.max': mergedCounter.max, 'data.uses.per': restType});
            return await featWithCharges.update(itemUpdate);
        }
    }

    static checkValueWithinRange(counter) {
        if(parseInt(counter.value) > counter.max) {
            counter.value = counter.max;
        } else if(parseInt(counter.value) < counter.min) {
            counter.value = counter.min;
        }

        return counter;
    }

    static deleteCounter(actorId, counterId) {
        const currentCounter = this.allCounters()[counterId];

        const keyDeletion = {
            [`-=${counterId}`]: null
        }

        let actor = this.getLinkedOrUnlinkedActor(actorId);
        
        return actor.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, keyDeletion);
    }

    static updateCounters(actorId, updateData) {
        let actor = this.getLinkedOrUnlinkedActor(actorId);
        return actor.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, updateData);
    }

    static addToCounter(counterId, updateValue) {
        var relevantCounter = this.allCounters()[counterId];
        let updatedCounter = relevantCounter;
        updatedCounter.value = Math.min(relevantCounter.max, parseInt(relevantCounter.value) + updateValue);
        this.updateCounter(relevantCounter.id, updatedCounter, relevantCounter);
    }

    static subtractFromCounter(counterId, updateValue) {
        var relevantCounter = this.allCounters()[counterId];
        let updatedCounter = relevantCounter;
        updatedCounter.value = Math.max(relevantCounter.min, relevantCounter.value - updateValue);
        this.updateCounter(relevantCounter.id, updatedCounter, relevantCounter);
    }

    static setToMax(counterId) {
        var relevantCounter = this.allCounters()[counterId];
        let updatedCounter = relevantCounter;
        updatedCounter.value = relevantCounter.max;
        this.updateCounter(relevantCounter.id, updatedCounter, relevantCounter);
    }

    static setToMin(counterId) {
        var relevantCounter = this.allCounters()[counterId];
        let updatedCounter = relevantCounter;
        updatedCounter.value = relevantCounter.min;
        this.updateCounter(relevantCounter.id, updatedCounter, relevantCounter);
    }

    static setTo0(counterId) {
        var relevantCounter = this.allCounters()[counterId];
        let updatedCounter = relevantCounter;
        updatedCounter.value = 0;
        this.updateCounter(relevantCounter.id, updatedCounter, relevantCounter);
    }
}

class SfrpgCounterAutoUpdater {

    /**
     * End of turn, or start of turn. Old actor is end of turn, new actor is start of turn.
     */
    static updateCombatCounters(combatEventData) {
        //Id is in different locations depending on if it's a linked or unlinked token.
        let isOldLinked = !combatEventData.oldCombatant._token.isLinked;
        const oldActorId = isOldLinked ? combatEventData.oldCombatant.data.actorId : combatEventData.oldCombatant.token.data._id;

        let isNewLinked = !combatEventData.oldCombatant._token.isLinked;
        const newActorId = isNewLinked ? combatEventData.newCombatant.data.actorId : combatEventData.newCombatant.token.data._id;
 
        const oldActorCounters = SfrpgCounterData.getCountersForActor(oldActorId);
        const newActorCounters = SfrpgCounterData.getCountersForActor(newActorId);        

        if(oldActorCounters !== undefined) {
            const endOfTurnCounters = Object.values(oldActorCounters).filter(counter => counter.autoOn == "endTurn");
            this.updateTurnCounters(endOfTurnCounters);
        }
        if(newActorCounters !== undefined) {
            const startOfTurnCounters = Object.values(newActorCounters).filter(counter => counter.autoOn == "startTurn");
            this.updateTurnCounters(startOfTurnCounters);
        }
    }

    static async updateTurnCounters(counters) {
        SfrpgCounter.log(false, 'Turn counters updating', counters);
        await counters.forEach(counter => { 
            this.autoValueUpdate(counter);  
        });
    }

    static autoValueUpdate(counter) {
        switch(counter.autoValue) {
            case 'addOne': {
                SfrpgCounterData.addToCounter(counter.id, 1);
                break;
            }
            case 'subOne': {
                SfrpgCounterData.subtractFromCounter(counter.id, 1);
                break;
            }
            case 'toMin': {
                SfrpgCounterData.setToMin(counter.id);
                break;
            }
            case 'toMax': {
                SfrpgCounterData.setToMax(counter.id);
                break;
            }
            case 'to0': {
                SfrpgCounterData.setTo0(counter.id);
            }
            default: {
                SfrpgCounter.log(false, 'Bad input in autoValue', counter)
            }
        }
    }

    static updateRestCounters(restEvent) {
        var restType = restEvent.restType;
        SfrpgCounter.log(false, "Resting", restEvent)
        let actorCounters;
        if(restEvent.actor.isToken) {
            actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor.parent?.id))
        } else if(!restEvent.actor.isToken) {
            actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor?.data?._id));
        }

        if(actorCounters.length > 0) {
            var restCounters;
            if(restType == 'short') {
                restCounters = actorCounters.filter(counter => counter.autoOn == "shortRest");
            } else if(restType == 'long') {
                restCounters = actorCounters.filter(counter => counter.autoOn == "longRest");
            } 
    
            this.updateTurnCounters(restCounters);
        }

        return;
    }

    static getActorIdFromItem(item) {
        if(item.parent.parent != null) {
            return item.parent.parent.data._id;
        } else {
            return item.parent.id;
        }
    }

    static async updateResourceCounters(item, updateData) {
        let actorId = this.getActorIdFromItem(item);
        let actorCounters = SfrpgCounterData.getCountersForActor(actorId);

        let resourceCounter = Object.values(actorCounters).find(counter => counter.itemId == item.id);
        
        SfrpgCounter.log(false, "updateResourceCounter", item, updateData, resourceCounter)

        if(resourceCounter != null) {
            let originalCounter = resourceCounter;

            if(updateData.data.base != null) {
                resourceCounter.value = updateData.data.base;
            }
            if(updateData.data.range?.max != null) {
                resourceCounter.max = updateData.data.range.max;
            }
            if(updateData.data.range?.min != null) {
                resourceCounter.min = updateData.data.range.min;
            }

            return await SfrpgCounterData.updateCounter(resourceCounter.id, resourceCounter, originalCounter, true);
        }
    }

    static updateFeatUsage(item, updateData) {
        let actorId = this.getActorIdFromItem(item);
        let actorCounters = SfrpgCounterData.getCountersForActor(actorId);
        if(Object.keys(actorCounters).length != 0) {
            let featCounter = Object.values(actorCounters).find(counter => counter.itemId == item.id);
            if(featCounter != null) {

                let originalCounter = featCounter;
                if(updateData.data.uses?.value != null) {
                    featCounter.value = updateData.data.uses.value; 
                }
                if(updateData.data.uses?.max != null) {
                    featCounter.max = updateData.data.uses.max;
                }
                if(updateData.data?.uses?.per == "lr") {
                    featCounter.autoOn = "longRest";
                    featCounter.autoValue = "toMax";
                } else if(updateData.data?.uses?.per == "sr") {
                    featCounter.autoOn = "shortRest";
                    featCounter.autoValue = "toMax";
                }

                return SfrpgCounterData.updateCounter(featCounter.id, featCounter, originalCounter);
            }
        }

    }

    static updateFeatActivation(counter) {
        if(counter.isItemAuto) {
            SfrpgCounter.log(false, 'Automated feat control', counter)
            const counterActor = SfrpgCounterData.getLinkedOrUnlinkedActor(counter.actorId)
            const feat = counterActor.data.items?.get(counter.itemId);
            let updateData;

            if(counter.value == counter.itemActivateAt) {
                updateData = true;
                SfrpgCounter.log(false, 'Activating feat', feat)
                if(counter.itemImg.includes('/conditions/')) {
                    counterActor.setCondition(counter.itemName.toLowerCase(), updateData)
                    return; 
                }
            } else if(counter.value == counter.itemDeactivateAt) {
                updateData = false;
                SfrpgCounter.log(false, 'Deactivating feat', feat)
                if(counter.itemImg.includes('/conditions/')) {
                    counterActor.setCondition(counter.itemName.toLowerCase(), updateData)
                    return; 
                }
            }

            SfrpgCounter.renderWindows();

            return feat?.setActive(updateData);
        }
    }

}

class SfrpgCounterConfig extends FormApplication {
    static get defaultOptions() {
        const defaults = super.defaultOptions;
      
        const overrides = {
          height: 'auto',
          width: 'auto',
          id: this.identifyActor(),
          template: SfrpgCounter.TEMPLATES.COUNTERLIST,
          actorId: this.identifyActor(),
          title: this.getTokenName(),
          min: 0,
          max: 3,
          value: 1,
          itemImg: SfrpgCounter.DEFAULT_ITEM_IMG,
          closeOnSubmit: false, 
          submitOnChange: true,
          label: "New counter"
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        
        return mergedOptions;
    }

    static identifyActor() {
        if(canvas.tokens.ownedTokens.length == 1) {
            return canvas.tokens.ownedTokens[0].actor.data._id;
        } else if(canvas.tokens.ownedTokens.length > 1) {
            if(!canvas.tokens?.controlled[0]?.data.actorLink) {
                return canvas.tokens.controlled[0]?.id;
            }
            if(canvas.tokens?.controlled[0]?.actor?.id != null) {
                return canvas.tokens.controlled[0].actor.id;
            }
        } 
    }

    static getTokenName() {
        if(canvas.tokens.controlled[0]?.data?.actorLink) {
            return canvas.tokens.controlled[0].actor.name; 
        } else {
            return canvas.tokens.get(this.identifyActor())?.data?.name + "  - (" + this.identifyActor() + ")";
        }
    }

    getData(options) {
        return {
            counters: SfrpgCounterData.getCountersForActor(options.actorId)
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', "[data-action]", this._handleButtonClick.bind(this));
    }

    async _handleButtonClick(event) {
        const clickedElement = $(event.currentTarget);
        const action = clickedElement.data().action;
        const counterId = clickedElement.parents('[data-counter-id]')?.data()?.counterId;

        switch (action) {
            case 'create': {
                await SfrpgCounterData.createCounter(this.options.actorId, {label: 'New counter', min: 0, max: 3, value: 1, itemImg: "icons/svg/mystery-man.svg"});
                this.render({"height": "auto", "width": "auto"});
                break;
            }

            case 'delete': {
                const confirmed = await Dialog.confirm({title: "Confirm Deletion", content: "Are you sure you want to delete the counter?"})
                
                if(confirmed) {
                    await SfrpgCounterData.deleteCounter(this.options.actorId, counterId);
                    this.render({"height": "auto", "width": "auto"});
                }
                break;
            }

            case 'increase': {
                await SfrpgCounterData.addToCounter(counterId, 1);
                SfrpgCounter.renderWindows();
                break;
            }

            case 'reduce': {
                await SfrpgCounterData.subtractFromCounter(counterId, 1);
                SfrpgCounter.renderWindows();
                break;
            }

            case 'edit': {
                const userId = $(event.currentTarget).parents('[data-user-id]')?.data()?.userId;
                SfrpgCounter.sfrpgCounterEdit.render(true, {counterId});
                break;
            }

            case 'context': {
                let options = SfrpgCounterConfig.getContextMenuOptions(counterId);
                let menu = new ContextMenu($(event.currentTarget.parentElement), ".counter-list-values-button", options);
                
                //The context menu will clip under the edge of the FormApplication if this isn't set. 
                let applicationWindow = $(event.currentTarget.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement);
                applicationWindow.css("overflowX", "visible");
                applicationWindow.css("overflowY", "visible");
                //I know, it's disgusting. Great-great-great-great-great-grandparent...
                //That's a one-shot waiting to happen. 
                //"Your great great great great great grandparent decides your style! You *MUST* wear the weird pants with too short legs!"
                //"No! I want to wear long legs where I have room to put my context menu!"
                //(Sounds dirtier than I intended, but that's creativity for you)
                menu.render($(event.currentTarget.parentElement));
                break;
            }

            default: 
            SfrpgCounter.log(false, 'Invalid action detected', action);
        }
    }

    static getContextMenuOptions(counterId) {
        let options = [];
        options.push(
            {
                name: "Set to max",
                icon: "<i class='fas fa-angle-double-up'></i>",
                callback: li => SfrpgCounterData.setToMax(counterId)
            },
            {
                name: "Set to 0",
                icon: "<i class='fas fa-circle'></i>",
                callback: li => SfrpgCounterData.setTo0(counterId)
            },
            {
                name: "Set to min",
                icon: "<i class='fas fa-angle-double-down'></i>",
                callback: li => SfrpgCounterData.setToMin(counterId)
            },
            {
                name: "Close",
                icon: "<i class='fas fa-times'></i>",
                callback: li => {}
            }
        );
        return options;
    }


}

class SfrpgCounterEdit extends FormApplication {
    static get defaultOptions() {
        const defaults = super.defaultOptions;
        
        const overrides = {
            height: 'auto',
            width: 'auto',
            template: SfrpgCounter.TEMPLATES.EDITCOUNTER,
            title: 'Edit counter',
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: true,
            counterId: null,
            min: 0,
            max: 3,
            value: 0,
            label: null,
            counterId: null,
            actorId: null,
            isAuto: false,
            autoOn: null,
            autoValue: null,
            itemId: null,
            itemName: null,
            itemImg: SfrpgCounter.DEFAULT_ITEM_IMG,
            itemActivateAt: 3,
            itemDeactivateAt: 0,
            isItemAuto: false,
            dragDrop: [{ dropSelector: null, dragSelector: null }],
            type: null,
            subType: null,
            isActorResource: false, 
            hasCharges: false
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    getData(options) {
        return SfrpgCounterData.getCounter(options.counterId);
    } 

    async _updateObject(event, formData) {
        await SfrpgCounterData.updateCounter(this.options.counterId, formData);
        SfrpgCounter.renderWindows();
    }

    /**
     * Stores the dropped item's counter-related data to the counter.
     * @param {Drop event, containing data about the dropped object} event 
     */
    async _onDrop(event) {
        const dragData = event.dataTransfer.getData('text/plain');
        const parsedDragData = JSON.parse(dragData);

        const counter = SfrpgCounterData.getCounter(this.options.counterId);
        SfrpgCounter.log(false, 'Feature drop data', counter, parsedDragData, this);

        if(parsedDragData.type == "Item") {
            const itemId = parsedDragData.data._id;
            this.addFeatInfoToCounter(this.options, counter, itemId);
            
            await SfrpgCounterData.updateCounter(counter.id, counter);
            const mergedOptions = foundry.utils.mergeObject(this.options, counter);    
            this.options = mergedOptions;
            
            SfrpgCounter.log(false, 'After counter update on drop', counter, parsedDragData, this);

            SfrpgCounter.renderWindows();
        }  
    }

    addFeatInfoToCounter(options, counter, itemId) {
        counter.itemId = itemId;
        let actor = SfrpgCounterData.getLinkedOrUnlinkedActor(counter.actorId);
        
        //Item data is in different places depending on if it's a linked or unlinked actor
        let itemData = {};
        if(actor.data?.token?.actorLink) {
            itemData = actor.items?.get(counter.itemId)?.data
        } else {
            itemData = actor.data?.actorData?.items?.find(thing => thing._id == counter.itemId);
        }
        SfrpgCounter.log(false, 'Feat Drop actor and itemData', actor, itemData);

        counter.itemName = itemData.name;
        counter.itemImg = itemData.img;
        counter.label = itemData.name;
        if(itemData.type == "actorResource") {
            counter.min = itemData.data.range.min;
            counter.max = itemData.data.range.max;
            counter.value = itemData.data.base;
            counter.type = itemData.data.type;
            counter.subType = itemData.data.subType;
            counter.isActorResource = true;
        } else if(itemData.type == "feat" && itemData.data?.uses?.max != 0) {
            counter.min = 0;
            counter.max = itemData.data?.uses?.max || counter.max;
            counter.value = itemData.data?.uses?.value || counter.value;
            counter.hasCharges = true;

            if(itemData.data?.uses?.per != null) {
                if(itemData.data.uses.per == "lr") {
                    counter.autoOn = "longRest";
                } else if(itemData.data.uses.per == "sr") {
                    counter.autoOn = "shortRest";
                }
                counter.autoValue = "toMax";
            } 
        } 

    }
    activateListeners(html) {
        super.activateListeners(html);
    }
}