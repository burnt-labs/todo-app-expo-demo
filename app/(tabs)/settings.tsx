import { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch, Platform, AppState } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeColor } from "@/hooks/useThemeColor";

if (!process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS) {
  throw new Error("EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS is not set in your environment file");
}

const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;

interface Settings {
  darkMode: boolean;
  notifications: boolean;
  language: string;
  timezone: string;
}

export default function Settings() {
  // Abstraxion hooks
  const { data: account, login, logout, isConnected, isConnecting } = useAbstraxionAccount();
  const { client } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const errorColor = useThemeColor({}, 'error');

  // State variables
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    darkMode: true,
    notifications: true,
    language: "en",
    timezone: "UTC"
  });
  const [editedSettings, setEditedSettings] = useState<Settings>({
    darkMode: true,
    notifications: true,
    language: "en",
    timezone: "UTC"
  });

  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const themedStyles = useMemo(() => ({
    container: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    title: {
      marginBottom: 20,
      textAlign: 'center' as const,
    },
    mainContainer: {
      flex: 1,
      gap: 20,
    },
    section: {
      padding: 15,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: borderColor,
    },
    settingRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    settingInfo: {
      flex: 1,
      marginRight: 15,
    },
    settingTitle: {
      marginBottom: 5,
    },
    settingDescription: {
      fontSize: 14,
      color: textColor,
    },
    pickerContainer: {
      marginTop: 10,
    },
    menuButton: {
      padding: 15,
      borderRadius: 10,
      alignItems: 'center' as const,
      backgroundColor: buttonColor,
    },
    logoutButton: {
      backgroundColor: errorColor,
    },
    fullWidthButton: {
      width: '100%' as const,
    },
    buttonText: {
      color: buttonTextColor,
      fontSize: 16,
      fontWeight: '500' as const,
    },
    disabledButton: {
      opacity: 0.5,
    },
    connectButtonContainer: {
      width: '100%' as const,
      paddingHorizontal: 20,
      alignItems: 'center' as const,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 20,
    },
    loadingText: {
      textAlign: 'center' as const,
      fontSize: 16,
      color: textColor,
    },
  }), [backgroundColor, borderColor, textColor, tintColor, buttonColor, buttonTextColor, errorColor]);

  // Fetch settings
  const fetchSettings = async () => {
    if (!queryClient) {
      console.log("Query client not initialized");
      setLoading(false);
      return;
    }
    
    if (!account?.bech32Address) {
      console.log("Account address not available");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      console.log("Fetching settings for address:", account.bech32Address);
      console.log("Using contract address:", contractAddress);
      
      const response = await queryClient.queryContractSmart(
        contractAddress,
        {
          UserDocuments: {
            owner: account.bech32Address,
            collection: "settings"
          }
        }
      );
      
      console.log("Settings response:", response);
      
      if (response?.documents) {
        const settingsDoc = response.documents.find(([id]: [string, any]) => id === account.bech32Address);
        if (settingsDoc) {
          const settingsData = JSON.parse(settingsDoc[1].data);
          console.log("Found settings data:", settingsData);
          setSettings(settingsData);
          setEditedSettings(settingsData);
        } else {
          console.log("No settings document found, initializing default settings");
          // Initialize with default settings if none exists
          const defaultSettings: Settings = {
            darkMode: false,
            notifications: true,
            language: "en",
            timezone: "UTC"
          };
          setSettings(defaultSettings);
          setEditedSettings(defaultSettings);
        }
      } else {
        console.log("No documents in response, initializing default settings");
        // Initialize with default settings if none exists
        const defaultSettings: Settings = {
          darkMode: false,
          notifications: true,
          language: "en",
          timezone: "UTC"
        };
        setSettings(defaultSettings);
        setEditedSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      // Initialize with default settings on error
      const defaultSettings: Settings = {
        darkMode: false,
        notifications: true,
        language: "en",
        timezone: "UTC"
      };
      setSettings(defaultSettings);
      setEditedSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  // Update settings
  const updateSettings = async (newSettings: Settings) => {
    if (!client || !account) return;
    
    setLoading(true);
    try {
      await client.execute(
        account.bech32Address,
        contractAddress,
        {
          Set: {
            collection: "settings",
            document: account.bech32Address,
            data: JSON.stringify(newSettings)
          }
        },
        "auto"
      );
      
      setSettings(newSettings);
      Alert.alert("Success", "Settings updated successfully!");
    } catch (error) {
      console.error("Error updating settings:", error);
      Alert.alert("Error", "Failed to update settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch settings when account changes
  useEffect(() => {
    console.log("Account changed, fetching settings");
    console.log("Account:", account);
    console.log("Is connected:", isConnected);
    console.log("Query client:", queryClient ? "available" : "not available");
    
    // Reset loading state if not connected
    if (!isConnected) {
      setLoading(false);
      return;
    }
    
    // Wait for both queryClient and account to be available
    if (queryClient && account?.bech32Address) {
      fetchSettings();
    } else {
      // Reset loading state if either is not available
      setLoading(false);
    }
  }, [account?.bech32Address, isConnected, queryClient]);

  // Add effect to handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isConnected && account?.bech32Address && queryClient) {
        console.log("App became active, refreshing settings");
        fetchSettings();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isConnected, account?.bech32Address, queryClient]);

  return (
    <ThemedView style={themedStyles.container}>
      <ScrollView 
        contentContainerStyle={themedStyles.contentContainer}
      >
        <ThemedText type="title" style={themedStyles.title}>Settings</ThemedText>

        {!isConnected ? (
          <View style={themedStyles.connectButtonContainer}>
            <TouchableOpacity
              onPress={login}
              style={[themedStyles.menuButton, themedStyles.fullWidthButton, isConnecting && themedStyles.disabledButton]}
              disabled={isConnecting}
            >
              <ThemedText style={themedStyles.buttonText}>
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={themedStyles.loadingContainer}>
            <ThemedText style={themedStyles.loadingText}>Loading settings...</ThemedText>
          </View>
        ) : (
          <View style={themedStyles.mainContainer}>
            {/* Dark Mode */}
            <ThemedView style={themedStyles.section}>
              <View style={themedStyles.settingRow}>
                <View style={themedStyles.settingInfo}>
                  <ThemedText type="defaultSemiBold" style={themedStyles.settingTitle}>Dark Mode</ThemedText>
                  <ThemedText style={themedStyles.settingDescription}>
                    Enable dark mode for better visibility in low-light conditions
                  </ThemedText>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleDarkMode}
                  disabled={loading}
                  trackColor={{ false: borderColor, true: tintColor }}
                  thumbColor={isDarkMode ? buttonColor : backgroundColor}
                />
              </View>
            </ThemedView>

            {/* Notifications */}
            <ThemedView style={themedStyles.section}>
              <View style={themedStyles.settingRow}>
                <View style={themedStyles.settingInfo}>
                  <ThemedText type="defaultSemiBold" style={themedStyles.settingTitle}>Notifications</ThemedText>
                  <ThemedText style={themedStyles.settingDescription}>
                    Receive notifications for important updates
                  </ThemedText>
                </View>
                <Switch
                  value={settings.notifications}
                  onValueChange={(value) => updateSettings({ ...settings, notifications: value })}
                  disabled={loading}
                  trackColor={{ false: borderColor, true: tintColor }}
                  thumbColor={settings.notifications ? buttonColor : backgroundColor}
                />
              </View>
            </ThemedView>

            {/* Language */}
            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.settingTitle}>Language</ThemedText>
              <View style={themedStyles.pickerContainer}>
                <ThemedText style={themedStyles.settingDescription}>
                  Current language: {settings.language}
                </ThemedText>
              </View>
            </ThemedView>

            {/* Timezone */}
            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.settingTitle}>Timezone</ThemedText>
              <View style={themedStyles.pickerContainer}>
                <ThemedText style={themedStyles.settingDescription}>
                  Current timezone: {settings.timezone}
                </ThemedText>
              </View>
            </ThemedView>

            {/* Logout Button */}
            <TouchableOpacity
              onPress={logout}
              style={[themedStyles.menuButton, themedStyles.logoutButton, themedStyles.fullWidthButton]}
            >
              <ThemedText style={themedStyles.buttonText}>Logout</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
} 