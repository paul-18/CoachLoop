# Coach Loop v94

Published v93, commit `cb881d59d13f6a85f17137720adebfff9c7e9bfd`, did not include the set-insertion code. Its notes described the control, but the running editor still only had the older set menu and bottom Add set.

This follow-up adds only that missing behavior:

- Tap a set’s number or W menu, then Insert set before or Insert set after.
- The new row copies that set’s prescription, units, load meaning and warm-up type, gets a new ID, and starts unfinished. Existing rows keep their IDs, order and actual results.
- For another warm-up before the first working set, open the last warm-up’s W menu and choose Insert set after. Mark as warm-up or working set is still available.
- Bottom Add set still adds only at the end.

No backup-format or IndexedDB change. v93’s other published fixes remain.
