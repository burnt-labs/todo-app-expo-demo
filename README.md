# XION Todo Mobile App

A React Native mobile application built with Expo that demonstrates how to interact with the DocuStore smart contract. This app allows users to create and manage todos, update their profiles, and customize app settings - all while leveraging XION's account abstraction capabilities.

## Features

- Connect with XION Meta Accounts
- Create, complete, and delete todos
- Update user profiles with display name, bio, and social links
- Customize app settings (dark mode, notifications, language, timezone)
- Gasless transactions using XION's Treasury contract
- Comprehensive theming system with light/dark mode support

## Prerequisites

- Node.js (v18 or later)
- npm
- iOS Simulator (for Mac) or Android Emulator

## Installation

1. Clone the repository:
```bash
git clone https://github.com/burnt-labs/todo-app-expo-demo.git
cd todo-app-expo-demo
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following environment variables:
```env
EXPO_PUBLIC_TODO_CONTRACT_ADDRESS="xion1svpts9q2ml4ahgc4tuu95w8cqzv988s6mf5mupt5kt56gvdnklks9hzar4"
EXPO_PUBLIC_TREASURY_CONTRACT_ADDRESS="xion1aza0jdzfc7g0u64k8qcvcxfppll0cjeer56k38vpshe3p26q5kzswpywp9"
EXPO_PUBLIC_RPC_ENDPOINT="https://rpc.xion-testnet-2.burnt.com:443"
EXPO_PUBLIC_REST_ENDPOINT="https://api.xion-testnet-2.burnt.com"
```

## Running the App

### iOS
```bash
npx expo run:ios
```

### Android
```bash
npx expo run:android
```

## App Structure

The app is organized into three main collections in the DocuStore contract:

### Todos Collection
```typescript
type Todo = {
  id: string;
  title: string;
  text: string;
  completed: boolean;
  created_at: string;
};
```

### Profiles Collection
```typescript
type Profile = {
  displayName: string;
  bio: string;
  avatar: string;
  socialLinks: {
    twitter?: string;
    github?: string;
    website?: string;
  };
};
```

### Settings Collection
```typescript
interface Settings {
  darkMode: boolean;
  notifications: boolean;
  language: string;
  timezone: string;
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For more information about XION and its features, visit:
- [XION Documentation](https://docs.burnt.com/xion)
- [XION Discord](https://discord.gg/burnt)
- [XION GitHub](https://github.com/burnt-labs)
