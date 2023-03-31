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
        SfrpgCounter.log(false, 'Token Icon Click (token, html)', token, html);
        
        let userId = token.actorId;

        $(counterButton).click((event) => {
            SfrpgCounter.initialize();
            SfrpgCounter.sfrpgCounterConfig.render(true, {userId})});
 
        let tokenItems = html.find('div.col.left');
        SfrpgCounter.log(false, 'Token Icon Html test (tokenItems, html)', tokenItems, html);

        tokenItems.append(counterButton);
    }

    static createButton() {
        let button = document.createElement("div");

		button.classList.add("control-icon");
        button.classList.add("counter-list-icon-button");
        button.title = game.i18n.localize('SFRPG-COUNTER.button-title');
        button.innerHTML = `<i class="fa-regular fa-wave-square"></i>`;

        return button;
    }
}

class SfrpgCounterData {
    static getLinkedOrUnlinkedActor(actorId) {
        SfrpgCounter.log(false, 'Getting linked or unlinked actor (id, linked, unlinked)', actorId, game.actors.get(actorId), canvas.tokens.get(actorId)?.document);
        return game.actors.get(actorId) || canvas.tokens.get(actorId).document;
    }

    static getCountersForActor(actorId) {
        SfrpgCounter.log(false, 'Getting counters for actor', actorId, game.actors.get(actorId))
        
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
        SfrpgCounter.log(false, 'Updating counter (mergedCounter, update, actor, originalCounter)', mergedCounter, update, actor, originalCounter);

        await actor.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, update)
        
        if(mergedCounter.isActorResource) {
            if(!actor.isToken && actor.isToken != undefined) {
                console.log('--------------------- ACTOR NOT TOKEN ---------------------');
                await actor.setResourceBaseValue(mergedCounter.type, mergedCounter.subType, mergedCounter.value);
            } else {
                await actor.actor.setResourceBaseValue(originalCounter.type, originalCounter.subType, originalCounter.value);
                console.log('------------------- ACTOR IS TOKEN ---------------------------')
            }
        }


        //Renders here to make sure windows are rendered on autoUpdate
        SfrpgCounter.renderWindows();
        
        return;
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
        let isOldLinked = combatEventData.oldCombatant.token.isLinked;
        const oldActorId = isOldLinked ? combatEventData.oldCombatant.actor.id : combatEventData.oldCombatant.token.id;

        let isNewLinked = combatEventData.newCombatant.token.isLinked;
        const newActorId = isNewLinked ? combatEventData.newCombatant.actor.id : combatEventData.newCombatant.token.id;
 
        const oldActorCounters = SfrpgCounterData.getCountersForActor(oldActorId);
        const newActorCounters = SfrpgCounterData.getCountersForActor(newActorId);        

        SfrpgCounter.log(false, "Update combat counters: isOldLinked, oldActorId, oldActorCounters, isNewLinked, newActorId, newActorCounters: ", 
        combatEventData, isOldLinked, oldActorId, oldActorCounters, isNewLinked, newActorId, newActorCounters);
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
        SfrpgCounter.log(false, "Resting", restEvent)
        var restType = restEvent.restType;
        let actorCounters;  //let actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor.id));
         if(restEvent.actor.isToken) {
            actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor.token.id))
        } else if(!restEvent.actor.isToken) {
            SfrpgCounter.log(false, "Resting linked actor (restEvent, actorId)", restEvent, restEvent.actor.id)

            actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor.id));
        } 

        if(actorCounters.length > 0) {
            var restCounters;
            if(restType == 'short') {
                restCounters = actorCounters.filter(counter => counter.autoOn == "shortRest" || counter.autoOn == "longRest");
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

    static updateFeatActivation(counter) {
        if(counter.isItemAuto) {
            SfrpgCounter.log(false, 'Automated feat control', counter)
            let counterActor = SfrpgCounterData.getLinkedOrUnlinkedActor(counter.actorId)
            let feat;
            if(counterActor.actor?.isToken) {
                counterActor = counterActor.actor;
            }
            SfrpgCounter.log(true, 'Update Feat Actication (actor)', counterActor)
            feat = counterActor.items?.get(counter.itemId);
                
            let updateData;

            if(counter.value == counter.itemActivateAt) {
                updateData = true;
                SfrpgCounter.log(false, 'Activating feat', feat, counterActor)
                
                //activate if counter is a condition
                if(counter.itemImg.includes('/conditions/')) {
                    let conditionName = counter.itemName.toLowerCase();
                    if(!counterActor.getCondition(conditionName)) {
                        counterActor.setCondition(counter.itemName.toLowerCase(), updateData)
                        return; 
                    }
                }
            } else if(counter.value == counter.itemDeactivateAt) {
                updateData = false;
                SfrpgCounter.log(false, 'Deactivating feat', feat, counterActor)

                //deactivate if counter is a condition
                if(counter.itemImg.includes('/conditions/')) {
                    let conditionName = counter.itemName.toLowerCase();
                    if(counterActor.getCondition(conditionName)) {
                        counterActor.setCondition(conditionName, updateData);
                        return;
                    }
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
          dragDrop: [{ dropSelector: null, dragSelector: null }],
          label: "New counter"
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        
        return mergedOptions;
    }

    static identifyActor() {
        SfrpgCounter.log(false, 'Identifying actor (owned, owned length, controlled)', canvas.tokens.controlled)
        //if not linked
        if(!canvas.tokens?.controlled[0]?.document.actorLink) {
            return canvas.tokens.controlled[0]?.id;
        } else { //if linked
            return canvas.tokens.controlled[0].actor.id;
        }
    }

    static getTokenName() {
        if(!canvas.tokens.controlled[0]) {
            return "Couldn't find a token. Have a cookie instead @";
        }
        if(canvas.tokens.controlled[0].document.actorLink) {
            return canvas.tokens.controlled[0].document.actor.name; 
        } else {
            let token = canvas.tokens.get(this.identifyActor());
            SfrpgCounter.log('Grabbing token name', token)
            return token.name + "  - (" + token.id + ")";
        } 
    }

    getData(options) {
        SfrpgCounter.log(false, 'Getting data', options)
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

    async _onDrop(event) {
        const dragData = event.dataTransfer.getData('text/plain');
        const parsedDragData = JSON.parse(dragData);

        //const counter = SfrpgCounterData.getCounter(this.options.counterId);
        SfrpgCounter.log(false, 'Feature configDrop data (parsedDragData, event)', parsedDragData, event);

        if(parsedDragData.type == "Item") {
            let uuidPeriodIndex = parsedDragData.uuid.lastIndexOf('.');
            let itemId = parsedDragData.uuid.substring(uuidPeriodIndex + 1);
            SfrpgCounter.log(false, 'Feature drop data (itemId)', itemId);
            
            let counter = this.createCounterFromDrop(this.options, parsedDragData, itemId);
            const mergedOptions = foundry.utils.mergeObject(this.options, counter);    
            this.options = mergedOptions;
            
            SfrpgCounter.log(false, 'After counter update on drop', counter, parsedDragData, this);

            SfrpgCounter.renderWindows();
        }  
    }

    async createCounterFromDrop(options, parsedDragData, itemId) {
        SfrpgCounter.log(false, 'Create counter from drop (parsedDragData, itemId', parsedDragData, itemId);
        let actor = SfrpgCounterData.getLinkedOrUnlinkedActor(options.id);
        
        let itemData = {};

        //If actor is linked, get the item from the actor's items. If not, get it from the token's 
        if(actor.actor?.isToken) {
            itemData = actor.actor.items.get(itemId);
        } else if(!actor.isToken) {
            itemData = actor.items.get(itemId); 
        }
        
        SfrpgCounter.log(false, 'Config Feat Drop (counter, actor, itemId, itemData)', actor, itemId, itemData);
        let counter = {};
        counter.itemName = itemData.name;
        counter.itemImg = itemData.img;
        counter.label = itemData.name;
        counter.itemId = itemId;
        if(itemData.type == "actorResource") {
            counter.min = itemData.system.range.min;
            counter.max = itemData.system.range.max;
            counter.value = itemData.actorResourceData.value;
            counter.type = itemData.system.type;
            counter.subType = itemData.system.subType;
            counter.isActorResource = true;
        } else {
            counter.min = 0;
            counter.max = 1;
            counter.value = 0; 
            counter.isItemAuto = true;
            counter.itemActivateAt = 1;
            counter.itemDeactivateAt = 0;
        }
        await SfrpgCounterData.createCounter(options.id, counter);
        this.submit();
    }

    async _updateObject(event, formData) {
        SfrpgCounter.renderWindows();
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
            itemActivateAt: null,
            itemDeactivateAt: null,
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
        SfrpgCounter.log(false, 'Feature drop data (counter, parsedDragData, event)', counter, parsedDragData, event);

        if(parsedDragData.type == "Item") {
            let uuidPeriodIndex = parsedDragData.uuid.lastIndexOf('.');
            let itemId = parsedDragData.uuid.substring(uuidPeriodIndex + 1);
            SfrpgCounter.log(false, 'Feature drop data (itemId)', itemId);
            
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
        SfrpgCounter.log(false, 'Feat Drop counter before fetched getLinkedOrUnlinkedActor', counter)
        let actor = SfrpgCounterData.getLinkedOrUnlinkedActor(counter.actorId);
        
        SfrpgCounter.log(false, 'Feat Drop actor', actor)
        
        let itemData = {};

        //If actor is linked, get the item from the actor's items. If not, get it from the token's 
        if(actor.actor?.isToken) {
            itemData = actor.actor.items.get(counter.itemId);
        } else if(!actor.isToken) {
            itemData = actor.items.get(counter.itemId); 
        }
    

        SfrpgCounter.log(false, 'Feat Drop (counter, actor, itemId, itemData)', counter, actor, itemId, itemData);

        counter.itemName = itemData.name;
        counter.itemImg = itemData.img;
        counter.label = itemData.name;
        if(itemData.type == "actorResource") {
            counter.min = itemData.system.range.min;
            counter.max = itemData.system.range.max;
            counter.value = itemData.actorResourceData.value;
            counter.type = itemData.system.type;
            counter.subType = itemData.system.subType;
            counter.isActorResource = true;
        } else if(itemData.type == "feat" && itemData.data?.uses?.max != 0) {
            counter.hasCharges = true;
        } 

    }
    activateListeners(html) {
        super.activateListeners(html);
    }
}