# sfrpg-counter

SFRPG Counter module keeps track of custom counters, with the ability to update automatically for combat (start of turn, end of turn) and rest (long and short). If an actor feature can be activated, it can also automatically activate and deactivate the feature. Combined with SFRPG's custom modifier and resource systems, it means that you can get it to automatically update some stats on an actor.

Once the module is active, it adds a button to the bottom right of the token right-click in Foundry. Clicking the button opens up the counters for an actor. You need to own a token on the canvas to use it. 

![Open module](https://media.giphy.com/media/dry9xkEijqemnkrJng/giphy.gif)

Create a new counter. Click the edit button. If you want it to track a feature, drag the feature, resource or condition from character sheet and drop it on the edit window. 

If it's tracking a resource or item with charges, changing the value in the module will overwrite any changes you've made directly to the resource's value on the character sheet, and vice versa. Other changes - icon image, name, min/max - are not saved from the module. Drag the resource to the counter's edit window again to keep those changes.

![Edit](https://media.giphy.com/media/VSZiksYgfPD3MSoaiQ/giphy.gif)

![Auto update and drag](https://media.giphy.com/media/8m2dUkgEXBu6ViMbgV/giphy.gif)

From the list of counters, click the numbers to get a context menu, with which you can reset the counter quickly.

*Auto-update counter value* is whether the counter's value should update automatically. You can set it to short rest, long rest, start of combat turn, end of combat turn. Example uses are attunement that goes up automatically at the start of combat round, or biohacks which reset on a long rest.

*Control feat activation* is whether the actor feat/condition should be activated/deactivated at specific values. Only works for feats without charges. Example uses are conditions that last a certain amount of rounds.


Known issues:
  * The window size is sometimes wrong. Close and open the window.
