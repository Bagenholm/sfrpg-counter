# sfrpg-counter

SFRPG Counter module keeps track of custom counters, with the ability to update automatically for combat (start of turn, end of turn) and rest (long and short). If an actor feature can be activated, it can also automatically activate and deactivate the feature. Combined with SFRPG's custom modifier and resource systems, it means that you can get it to automatically update some stats on an actor.

Once the module is active, it adds a button to the bottom right of the token right-click in Foundry. Clicking the button opens up the counters for an actor. You need to own a token on the canvas to use it. 

Create a new counter. Click the edit button. If you want it to track a feature, drag the feature, resource or condition from character sheet and drop it on the edit window. 

If it's tracking a resource, changing the value in the module will overwrite any changes you've made directly to the resource's value on the character sheet. If you've made changes to the resource that you want to keep (icon image, name, min/max), drag the resource to the counter's edit window again.

*Auto-update counter value* is whether the counter's value should update automatically.

*Control feat activation* is whether the actor feat/condition should be activated/deactivated at specific values.

Known issues:
  * The window size is sometimes wrong. Close and open the window.

