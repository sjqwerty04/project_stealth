export type SavePickerDeps = {
  openPicker: () => void;
  onSaveIntent?: () => void;
};

/** Save opens the list picker and, in the same press, tells the caller the person engaged with this film. */
export function openSavePicker(deps: SavePickerDeps): void {
  deps.openPicker();
  deps.onSaveIntent?.();
}
