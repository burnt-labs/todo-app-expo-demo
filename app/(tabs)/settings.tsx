import { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, Switch, Platform, AppState } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Picker } from "@react-native-picker/picker";

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
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <ThemedText type="title" style={styles.title}>Settings</ThemedText>

      {!isConnected ? (
        <View style={styles.connectButtonContainer}>
          <TouchableOpacity
            onPress={login}
            style={[styles.menuButton, styles.fullWidthButton, isConnecting && styles.disabledButton]}
            disabled={isConnecting}
          >
            <ThemedText style={styles.buttonText}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading settings...</ThemedText>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Dark Mode */}
          <ThemedView style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText type="defaultSemiBold" style={styles.settingTitle}>Dark Mode</ThemedText>
                <ThemedText style={styles.settingDescription}>
                  Enable dark mode for better visibility in low-light conditions
                </ThemedText>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={(value) => updateSettings({ ...settings, darkMode: value })}
                disabled={loading}
              />
            </View>
          </ThemedView>

          {/* Notifications */}
          <ThemedView style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText type="defaultSemiBold" style={styles.settingTitle}>Notifications</ThemedText>
                <ThemedText style={styles.settingDescription}>
                  Receive notifications for important updates
                </ThemedText>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={(value) => updateSettings({ ...settings, notifications: value })}
                disabled={loading}
              />
            </View>
          </ThemedView>

          {/* Language */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.settingTitle}>Language</ThemedText>
            <View style={styles.pickerContainer}>
              <ThemedText style={styles.settingDescription}>
                Current language: {settings.language}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Timezone */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.settingTitle}>Timezone</ThemedText>
            <View style={styles.pickerContainer}>
              <ThemedText style={styles.settingDescription}>
                Current timezone: {settings.timezone}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={logout}
            style={[styles.menuButton, styles.logoutButton, styles.fullWidthButton]}
          >
            <ThemedText style={styles.buttonText}>Logout</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    gap: 20,
  },
  section: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: "#666",
  },
  pickerContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50,
  },
  menuButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    marginTop: 20,
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.5,
  },
  connectButtonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
  },
}); 