/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    card: '#fff',
    border: '#ddd',
    input: '#fff',
    inputText: '#11181C',
    placeholder: '#666',
    button: '#2196F3',
    buttonText: '#fff',
    disabled: '#ccc',
    error: '#ff3b30',
    success: '#4CAF50',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    card: '#1C1F20',
    border: '#2D3235',
    input: '#1C1F20',
    inputText: '#ECEDEE',
    placeholder: '#9BA1A6',
    button: '#2196F3',
    buttonText: '#fff',
    disabled: '#2D3235',
    error: '#ff453a',
    success: '#32d74b',
  },
};
