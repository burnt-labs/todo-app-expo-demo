import { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, Image, Linking, AppState } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";

if (!process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS) {
  throw new Error("EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS is not set in your environment file");
}

const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;

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

export default function Profile() {
  // Abstraxion hooks
  const { data: account, login, isConnected, isConnecting } = useAbstraxionAccount();
  const { client } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();

  // State variables
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editedProfile, setEditedProfile] = useState<Profile>({
    displayName: "",
    bio: "",
    avatar: "",
    socialLinks: {}
  });

  // Fetch profile
  const fetchProfile = async () => {
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
      console.log("Fetching profile for address:", account.bech32Address);
      console.log("Using contract address:", contractAddress);
      
      const response = await queryClient.queryContractSmart(
        contractAddress,
        {
          UserDocuments: {
            owner: account.bech32Address,
            collection: "profiles"
          }
        }
      );
      
      console.log("Profile response:", response);
      
      if (response?.documents) {
        const profileDoc = response.documents.find(([id]: [string, any]) => id === account.bech32Address);
        if (profileDoc) {
          const profileData = JSON.parse(profileDoc[1].data);
          console.log("Found profile data:", profileData);
          setProfile(profileData);
          setEditedProfile(profileData);
        } else {
          console.log("No profile document found, initializing empty profile");
          // Initialize with empty profile if none exists
          const emptyProfile: Profile = {
            displayName: "",
            bio: "",
            avatar: "",
            socialLinks: {}
          };
          setProfile(emptyProfile);
          setEditedProfile(emptyProfile);
        }
      } else {
        console.log("No documents in response, initializing empty profile");
        // Initialize with empty profile if none exists
        const emptyProfile: Profile = {
          displayName: "",
          bio: "",
          avatar: "",
          socialLinks: {}
        };
        setProfile(emptyProfile);
        setEditedProfile(emptyProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Initialize with empty profile on error
      const emptyProfile: Profile = {
        displayName: "",
        bio: "",
        avatar: "",
        socialLinks: {}
      };
      setProfile(emptyProfile);
      setEditedProfile(emptyProfile);
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async () => {
    if (!client || !account) return;
    
    setLoading(true);
    try {
      await client.execute(
        account.bech32Address,
        contractAddress,
        {
          Set: {
            collection: "profiles",
            document: account.bech32Address,
            data: JSON.stringify(editedProfile)
          }
        },
        "auto"
      );
      
      setProfile(editedProfile);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch profile when account changes
  useEffect(() => {
    console.log("Account changed, fetching profile");
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
      fetchProfile();
    } else {
      // Reset loading state if either is not available
      setLoading(false);
    }
  }, [account?.bech32Address, isConnected, queryClient]);

  // Add effect to handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isConnected && account?.bech32Address && queryClient) {
        console.log("App became active, refreshing profile");
        fetchProfile();
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
      <ThemedText type="title" style={styles.title}>My Profile</ThemedText>

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
          <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
        </View>
      ) : isEditing ? (
        <View style={styles.mainContainer}>
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Display Name</ThemedText>
            <TextInput
              style={styles.input}
              value={editedProfile.displayName}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, displayName: text })}
              placeholder="Enter display name"
              placeholderTextColor="#666"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Bio</ThemedText>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={editedProfile.bio}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, bio: text })}
              placeholder="Enter bio"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Avatar URL</ThemedText>
            <TextInput
              style={styles.input}
              value={editedProfile.avatar}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, avatar: text })}
              placeholder="Enter avatar URL"
              placeholderTextColor="#666"
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Social Links</ThemedText>
            <TextInput
              style={styles.input}
              value={editedProfile.socialLinks.twitter || ""}
              onChangeText={(text) => setEditedProfile({
                ...editedProfile,
                socialLinks: { ...editedProfile.socialLinks, twitter: text }
              })}
              placeholder="Twitter URL"
              placeholderTextColor="#666"
            />
            <TextInput
              style={[styles.input, styles.socialInput]}
              value={editedProfile.socialLinks.github || ""}
              onChangeText={(text) => setEditedProfile({
                ...editedProfile,
                socialLinks: { ...editedProfile.socialLinks, github: text }
              })}
              placeholder="GitHub URL"
              placeholderTextColor="#666"
            />
            <TextInput
              style={[styles.input, styles.socialInput]}
              value={editedProfile.socialLinks.website || ""}
              onChangeText={(text) => setEditedProfile({
                ...editedProfile,
                socialLinks: { ...editedProfile.socialLinks, website: text }
              })}
              placeholder="Website URL"
              placeholderTextColor="#666"
            />
          </ThemedView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={updateProfile}
              style={[styles.menuButton, styles.fullWidthButton, loading && styles.disabledButton]}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>
                {loading ? "Saving..." : "Save Changes"}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsEditing(false);
                setEditedProfile(profile || editedProfile);
              }}
              style={[styles.menuButton, styles.secondaryButton, styles.fullWidthButton]}
            >
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          <ThemedView style={styles.section}>
            <View style={styles.profileHeader}>
              {profile?.avatar && (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatar}
                />
              )}
              <View style={styles.profileInfo}>
                <ThemedText type="title" style={styles.displayName}>
                  {profile?.displayName || "Anonymous"}
                </ThemedText>
                <ThemedText style={styles.addressText}>
                  {account?.bech32Address}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {profile?.bio && (
            <ThemedView style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Bio</ThemedText>
              <ThemedText style={styles.bioText}>{profile.bio}</ThemedText>
            </ThemedView>
          )}

          {(profile?.socialLinks?.twitter || profile?.socialLinks?.github || profile?.socialLinks?.website) && (
            <ThemedView style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Social Links</ThemedText>
              {profile.socialLinks.twitter && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(profile.socialLinks.twitter!)}
                  style={styles.socialLink}
                >
                  <ThemedText style={styles.socialLinkText}>Twitter</ThemedText>
                </TouchableOpacity>
              )}
              {profile.socialLinks.github && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(profile.socialLinks.github!)}
                  style={styles.socialLink}
                >
                  <ThemedText style={styles.socialLinkText}>GitHub</ThemedText>
                </TouchableOpacity>
              )}
              {profile.socialLinks.website && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(profile.socialLinks.website!)}
                  style={styles.socialLink}
                >
                  <ThemedText style={styles.socialLinkText}>Website</ThemedText>
                </TouchableOpacity>
              )}
            </ThemedView>
          )}

          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={[styles.menuButton, styles.fullWidthButton]}
          >
            <ThemedText style={styles.buttonText}>Edit Profile</ThemedText>
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
  sectionTitle: {
    marginBottom: 15,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    marginBottom: 5,
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#666",
  },
  socialLink: {
    paddingVertical: 8,
  },
  socialLinkText: {
    fontSize: 16,
    color: "#2196F3",
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    backgroundColor: "#fff",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  socialInput: {
    marginTop: 10,
  },
  buttonContainer: {
    gap: 10,
  },
  menuButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#666",
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