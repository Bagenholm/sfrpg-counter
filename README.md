# sfrpg-counter

SFRPG Counter module keeps track of custom counters, with the ability to update automatically for combat (start of turn, end of turn) and rest (long and short). If an actor feature can be activated, it can also automatically activate and deactivate the feature. Combined with SFRPG's custom modifier and resource systems, it means that you can get it to automatically update some stats on an actor.

Once the module is active, it adds a button to the bottom left of the token right-click in Foundry. Clicking the button opens up the counters for an actor. You need to own a token on the canvas to use it. 

![Open module](https://media.giphy.com/media/dry9xkEijqemnkrJng/giphy.gif)

You can create a counter in two ways. 

First, by dragging a Condition, Feat or Actor Resource from a character sheet to the counter window.

Second, by clicking the +Add Counter button.

You can drag a Condition, Feat or Actor Resource from a character sheet to the edit window to grab its data.

If it's tracking an actor resource, changing the value in the module will overwrite any changes you've made directly to the resource's value on the character sheet. Other changes - icon image, name, min/max - are not saved from the module; meaning that if you make changes to the character sheet's actor resource, you need to drag the resource to the counter's edit window again to synch them to the module. **Note:**  This also means that if you make a change to the character sheet's actor resource value, the module won't know, and will "overwrite" the character sheet's actor resource value.

![Edit](https://media.giphy.com/media/VSZiksYgfPD3MSoaiQ/giphy.gif)

![Auto update and drag](https://media.giphy.com/media/8m2dUkgEXBu6ViMbgV/giphy.gif)

From the list of counters, click the numbers to get a context menu, with which you can set the counter value easily. 

***Auto-update counter value*** is whether the counter's value should update from system triggers. You can set it to short rest, long rest, start of combat turn, end of combat turn. 

*Examples*
*Biohacks*. You have an actor resource that is set to track the character's available charges of biohacks. Drag the feat to the counter window. The player gets them all back on a short rest. So the setting you want is to enable Auto-Update Counter Value, then on Short rest, by setting to max.

*Stellar Attunement*. You have an actor resource that tracks the character's attunement level. Drag the Stellar Attunement to the counter window. You want to be in Photon Mode, so you want to enable Auto-Update Counter Value, then on Start of turn, by adding 1. It will add one to the counter every time it's the character's turn, but won't go over the actor resource's max value. Once you're out of combat, or lose your attunement due to using a stellar revelation, you click the numbers in the counter list window, and click Set to 0. If you want to go to Graviton Mode instead, change the settings to Start of turn, by subtracting 1.

***Control feat activation*** is whether the actor feat/condition should be activated/deactivated at specific values. 

*Examples*
*Bodyguard*. You have a feat with a constant modifier to reduce the character's AC as per the Bodyguard effect. You want it to only last for one round after usage. Drag the Bodyguard feat to the counter window. Enable Auto-Update Counter Value, on start of combat turn, subtract 1. Also enable Control Feat Activation, activate feat on 1, deactivate feat on 0. To activate Bodyguard, change the counter to 1. It will automatically turn off at the start of your round as the counter subtracts 1 and reaches the Deactivate At-value of 0.

*Conditions*. A character is is Entangled for 3 rounds. Go to the character sheet's modifier page and enable Entangled. The feat that appears under Conditions below the list of available conditions, drag that to the counter window. Set Auto-Update Counter Value, on end of turn, by subtracting 1. Also enable Control Feat Activation, activate on 3, deactivate feat on 3. Once the character has ended its turn 3 times, Entangled will automatically turn off.

Known issues:
  * The window size is sometimes wrong. Close and open the window.
