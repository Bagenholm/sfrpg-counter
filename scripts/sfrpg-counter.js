Hooks.once('init', async function() {
    console.log('sfrpg-counter | SFRPG-counter active')
});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(SfrpgCounter.ID);
});

Hooks.on('renderPlayerList', (playerList, html) => {
    const loggedInUserListItem = html.find(`[data-user-id="${game.userId}"]`)
    
    const tooltip = game.i18n.localize('COUNTER-LIST.button-title');
    
    loggedInUserListItem.append(
    `<button type='button' class='counter-list-icon-button flex0' title='${tooltip}'><i class='fas fa-tasks'></i></button>`
    );
    
    html.on('click', '.counter-list-icon-button', (event) => {
    const userId = $(event.currentTarget).parents('[data-user-id]')?.data()?.userId;
    SfrpgCounter.initialize();
    SfrpgCounter.sfrpgCounterConfig.render(true, {userId});
    });
});

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

    
    static renderWindows() {
        this.sfrpgCounterConfig.render();
        this.sfrpgCounterEdit.render();
    }

}

class SfrpgCounterData {
    static getCountersForActor(actorId) {
        return game.actors.get(actorId)?.getFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS);
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

        return game.actors.get(actorId)?.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, newCounters);
    }

    static allCounters() {
        const allCounters = game.actors.reduce((accumulator, actor) => {
            const actorCounters = this.getCountersForActor(actor.id);

            return {
                ...accumulator,
                ...actorCounters
            }
        }, {});
        return allCounters;
    }

    static updateCounter(counterId, updateData) {
        const currentCounter = this.allCounters()[counterId];
        if(currentCounter.isItemAuto) {
            SfrpgCounterAutoUpdater.updateFeatActivation(currentCounter);
        }
        const update = {
            [counterId]: updateData
        }

        game.actors.get(currentCounter.actorId)?.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, update);
        SfrpgCounter.sfrpgCounterConfig.render();
        SfrpgCounter.sfrpgCounterEdit.render(false, currentCounter);
        return;
    }

    /*static updateEditCounter(counterId, actorId, updateData) {
        SfrpgCounter.log(false, 'Update edit counter', updateData);

        updateData.counterId = counterId;

        const update = {
            [counterId]: updateData
        }

        return game.actors.get(actorId)?.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, update);
    } */

    static deleteCounter(actorId, counterId) {
        const currentCounter = this.allCounters()[counterId];

        const keyDeletion = {
            [`-=${counterId}`]: null
        }
        
        return game.actors.get(actorId)?.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, keyDeletion);
    }

    static updateCounters(actorId, updateData) {
        return game.actors.get(actorId)?.setFlag(SfrpgCounter.ID, SfrpgCounter.FLAGS.COUNTERS, updateData);
    }

    static addToCounter(counterId, updateValue) {
        var relevantCounter = this.allCounters()[counterId];
        relevantCounter.value = Math.min(relevantCounter.max, parseInt(relevantCounter.value) + updateValue);
        SfrpgCounter.log(false, 'addToCounter', relevantCounter.max, relevantCounter.value, updateValue)
        this.updateCounter(relevantCounter.id, relevantCounter);
    }

    static subtractFromCounter(counterId, updateValue) {
        var relevantCounter = this.allCounters()[counterId];
        relevantCounter.value = Math.max(relevantCounter.min, relevantCounter.value - updateValue);
        this.updateCounter(relevantCounter.id, relevantCounter);
    }

    static setToMax(counterId) {
        var relevantCounter = this.allCounters()[counterId];
        relevantCounter.value = relevantCounter.max;
        this.updateCounter(relevantCounter.id, relevantCounter);
    }

    static setToMin(counterId) {
        var relevantCounter = this.allCounters()[counterId];
        relevantCounter.value = relevantCounter.min;
        this.updateCounter(relevantCounter.id, relevantCounter);
    }
}

class SfrpgCounterAutoUpdater {

    static updateCombatCounters(combatEventData) {
        const oldActorId = combatEventData.oldCombatant.data.actorId;
        const newActorId = combatEventData.newCombatant.data.actorId;
        const oldActorCounters = SfrpgCounterData.getCountersForActor(oldActorId);
        const newActorCounters = SfrpgCounterData.getCountersForActor(newActorId);        
        
        SfrpgCounter.log(false, 'Update combat counters', oldActorCounters, newActorCounters);

        if(oldActorCounters !== undefined) {
            const endOfTurnCounters = Object.values(oldActorCounters).filter(counter => counter.autoOn == "endTurn");
            this.updateTurnCounters(endOfTurnCounters);
        }
        if(newActorCounters !== undefined) {
            const startOfTurnCounters = Object.values(newActorCounters).filter(counter => counter.autoOn == "startTurn");
            this.updateTurnCounters(startOfTurnCounters);
        }
    }

    static updateTurnCounters(counters) {
        SfrpgCounter.log(false, 'Turn counters updating', counters);
        counters.forEach(counter => { 
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
            default: {
                SfrpgCounter.log(false, 'Bad input in autoValue', counter)
            }
        }
    }

    static updateRestCounters(restEvent) {
        var restType = restEvent.restType;
        const actorCounters = Object.values(SfrpgCounterData.getCountersForActor(restEvent.actor?.data?._id));
        var restCounters;
        if(restType == 'short') {
            restCounters = actorCounters.filter(counter => counter.autoOn == "shortRest");
        } else if(restType == 'long') {
            restCounters = actorCounters.filter(counter => counter.autoOn == "longRest");
        } 

        SfrpgCounter.log(false, 'Update rest Counters', restCounters)

        this.updateTurnCounters(restCounters);

    }

    static updateFeatActivation(counter) {
        if(counter.isItemAuto) {
            const counterActor = game.actors?.get(counter.actorId);
            const feat = counterActor.data.items?.get(counter.itemId);
            let updateData;

            if(counter.value == counter.itemActivateAt) {
                updateData = true;
                SfrpgCounter.log(false, 'Activating feat', feat)
            } else if(counter.value == counter.itemDeactivateAt) {
                updateData = false;
                SfrpgCounter.log(false, 'Deactivating feat', feat)
            }

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
          id: 'sfrpg-counter',
          template: SfrpgCounter.TEMPLATES.COUNTERLIST,
          title: 'Counter List',
          actorId: this.identifyActor(),
          min: 0,
          max: 3,
          value: 1,
          itemImg: SfrpgCounter.DEFAULT_ITEM_IMG,
          closeOnSubmit: false, // do not close when submitted
          submitOnChange: true // submit when any input changes
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        
        return mergedOptions;
    }

    static identifyActor() {
        if(canvas.tokens?.controlled[0]?.actor?.id != null) {
            return canvas.tokens.controlled[0].actor.id;
        } /* else if(game.user.character.data._id != null) {
            return game.user.character.data._id; 
        } */
        ui.notifications.warn('No actor chosen.')
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
                await SfrpgCounterData.createCounter(this.options.actorId, {min: 0, max: 3, value: 1, itemImg: "icons/svg/mystery-man.svg"});
                this.render();
                break;
            }

            case 'delete': {
                const confirmed = await Dialog.confirm({title: "Confirm Deletion", content: "Are you sure you want to delete the counter?"})
                
                if(confirmed) {
                    await SfrpgCounterData.deleteCounter(this.options.actorId, counterId);
                    this.render();
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
                const counter = SfrpgCounterData.getCounter(counterId);
                SfrpgCounter.log(false, 'Edit counter', counterId, counter);
                SfrpgCounter.sfrpgCounterEdit.render(true, counter);
                break;
            }

            default: 
            SfrpgCounter.log(false, 'Invalid action detected', action);
        }
        SfrpgCounter.log(false, 'Button Clicked!', {action, counterId});
    }


}

class SfrpgCounterEdit extends FormApplication {
    static get defaultOptions() {
        const defaults = super.defaultOptions;
        
        const overrides = {
            height: 'auto',
            width: 'auto',
            id: 'sfrpg-counter',
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
            dragDrop: [{ dropSelector: null, dragSelector: null }]
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    getData(options) {
        return options;
    }

    async _updateObject(event, formData) {
    
        await SfrpgCounterData.updateCounter(this.options.id, formData);

        const mergedOptions = foundry.utils.mergeObject(this.options, formData);
        this.options = mergedOptions;
    }

    async _onDrop(event) {
        const dragData = event.dataTransfer.getData('text/plain');
        const parsedDragData = JSON.parse(dragData);

        if(parsedDragData.type == "Item") {
            const counter = SfrpgCounterData.getCounter(this.options.id);

            counter.itemId = parsedDragData.data._id;
            let itemName = game.actors?.get(counter.actorId)?.items?.get(counter.itemId)?.data?.name;
            counter.itemName = itemName;
            counter.itemImg = game.actors?.get(counter.actorId)?.items?.get(counter.itemId)?.data?.img;
            
            const mergedOptions = foundry.utils.mergeObject(this.options, counter);
            this.options = mergedOptions;
            await SfrpgCounterData.updateCounter(counter.id, counter);
            SfrpgCounter.log(false, 'After counter update on drop', counter, parsedDragData, this);

            this.render();
        }  
    }

    activateListeners(html) {
        super.activateListeners(html);
    }
}