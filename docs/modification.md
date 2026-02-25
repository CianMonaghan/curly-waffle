Character.applyModification is the mutation dispatcher. It interprets modification.type and routes to a specific implementation. This centralization ensures consistent logging and reversibility.

 Dispatcher Responsibilities
•	Validate payload shape enough to avoid corrupt writes.
•	Read and mutate only through known mutation branches.
•	Capture reversal data before/while mutating.
•	Return a normalized AppliedModification record (type + payload + reversalData).
•	Avoid derived recomputation inside each branch if batching is supported; otherwise recompute after feature application.

 Apply/Reverse Symmetry Contract
For every modification implementation, define applyX() and reverseX(). The reverse method must use reversalData from the original apply call, not infer state by reading current values only.
// shape of stored applied mod
{
  type: "statDelta",
  payload: { stat: "DEX", delta: 2 },
  reversalData: { appliedDelta: 2 }
}

   Common Failure Modes and Minimal Fixes (Non-Security)
•	Overlapping set effects restore wrong previous value -> use layered overrides or AC formulas for base calculations.
•	List/map conflicts between multiple sources -> track ownership/source IDs where practical.
•	Mutation and recompute inside loops -> batch when applying a feature with many modifications.
•	Direct writes to derived fields -> move logic into compute functions unless field is intentionally source state.
  Invertibility README - How Reversal Works (and Why It Matters)
Invertibility means the editor can remove previously applied changes and return the Character to the correct prior state. This supports level down, unequip, unattune, subclass swap, race/background replacement, homebrew experimentation, and feature rollback.
 
  Invertibility Data Structures
// conceptual runtime records in JavaScript
AppliedFeatureRecord = {
  instanceId,
  sourceId,           // item id, class level source, subclass id, etc.
  featureId,
  appliedMods: [
    { type, payload, reversalData }
  ]
};

character.ActiveFeatureRefs = new Map();
   
   Reversal Algorithm
8.	Look up AppliedFeatureRecord by feature instance ID.
9.	Iterate appliedMods in reverse order (LIFO) to preserve dependency order.
10.	Dispatch reverseAppliedModification(appliedMod).
11.	Remove feature instance record from ActiveFeatureRefs.
12.	Recompute derived values.
   
    Why Reverse Order Matters
Features may write related state across multiple fields. Reversing in the same order can temporarily produce invalid intermediate states or miss expected invariants. Reverse order approximates stack unwinding and is safer.
// apply order: add formula -> add bonus
// reverse order should be: remove bonus -> remove formula
   
   Invertibility and Editor UX
•	Level down uses the same mechanism as removing level-gained feature instances.
•	Unequipping an item reverses all active features from that item source.
•	Swapping subclass first reverses old subclass features, then applies new subclass features.
•	Background/race replacement can be implemented as reverse old attachment features + apply new attachment features.
