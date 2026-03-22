# Slice 7: Tool-Aware Module Process Training

## Target

Begin Stage 2 by training the native model on tool-aware process behavior for
realistic module and browser tasks.

## Scope

- `dev-research/native-model/`
- `dev-research/native-model/evals/`
- `scripts/`
- `src/improve/` only if shared capture/report substrate changes are required
- no broad runtime-taxonomy rewrites in this slice

## Required

- capture inspect/edit/validate/revise traces as first-class training data
- use realistic module tasks rather than generic coding tasks
- include browser or interaction validation where the module/UI task requires it
- preserve the distinction between symbolic-output success and process success

## Preserve

- Stage 1 symbolic-output boundaries remain usable
- provider/model bindings stay outside `src/`
- module/browser tasks remain Plaited-native rather than generic benchmarks

## Avoid

- collecting process traces on abstract framework-only tasks when the real goal
  is module and UX quality
- assuming every module requires browser validation
- weakening validation rules to manufacture process data

## Acceptance Criteria

- Stage 2 process traces exist for realistic module/browser tasks
- training and evaluation distinguish final-output quality from process quality
- the slice moves the model toward tool-aware module operation rather than just
  better static answers
