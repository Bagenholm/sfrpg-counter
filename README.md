# sfrpg-counter

SFRPG Counter module keeps track of custom counters, with the ability to update automatically for combat (start of turn, end of turn) and rest (long and short). If an actor feature can be activated, it can also automatically activate and deactivate the feature. Combined with SFRPG's custom modifier system, it means that you can get it to automatically update some stats on an actor.

This module has been made mainly for personal use. The code is bad, the interface is bad - but it mostly kinda-sorta works. 

Once the module is active, it adds a button to the player list in the bottom left of Foundry. Clicking the button opens up the counters for an actor. You need to own a token on the canvas to use it. If you own more than one token, you need to have a token targeted.

Create a new counter. Click the edit button. If you want it to track a feature, drag the feature (or condition) from character sheet and drop it on the edit window. 

AutoUpdate is whether the counter's value should update automatically.

Auto-update feat is whether the actor feat should be activated/deactivated at specific values.

Known issues:
  * If a feat or condition doesn't de/activate on the set values, try toggling Control Feat Activation off and on again. 
  * The window size is sometimes wrong. Close and open the window.
  * Having a counter edit window open when actor rests, or there's a new combat turn, it sometimes switches to show another counter's edit window.
