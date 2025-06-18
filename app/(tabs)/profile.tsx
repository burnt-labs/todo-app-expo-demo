import { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, Image, Linking, AppState } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";

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

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');

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
    sectionTitle: {
      marginBottom: 15,
    },
    profileHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
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
      flexWrap: 'wrap' as const,
      flexShrink: 1,
      color: textColor,
    },
    bioText: {
      fontSize: 16,
      lineHeight: 24,
      color: textColor,
    },
    socialLink: {
      paddingVertical: 8,
    },
    socialLinkText: {
      fontSize: 16,
      color: tintColor,
    },
    input: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 16,
      borderColor: borderColor,
      backgroundColor: backgroundColor,
    },
    bioInput: {
      height: 100,
      textAlignVertical: 'top' as const,
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
      alignItems: 'center' as const,
      backgroundColor: buttonColor,
    },
    secondaryButton: {
      backgroundColor: buttonColor,
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
  }), [backgroundColor, borderColor, textColor, tintColor, buttonColor, buttonTextColor]);

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
    <ThemedView style={themedStyles.container}>
      <ScrollView 
        contentContainerStyle={themedStyles.contentContainer}
      >
        <ThemedText type="title" style={themedStyles.title}>My Profile</ThemedText>

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
            <ThemedText style={themedStyles.loadingText}>Loading profile...</ThemedText>
          </View>
        ) : isEditing ? (
          <View style={themedStyles.mainContainer}>
            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Display Name</ThemedText>
              <TextInput
                style={[themedStyles.input, { color: textColor }]}
                value={editedProfile.displayName}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, displayName: text })}
                placeholder="Enter display name"
                placeholderTextColor={useThemeColor({}, 'placeholder')}
              />
            </ThemedView>

            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Bio</ThemedText>
              <TextInput
                style={[themedStyles.input, themedStyles.bioInput, { color: textColor }]}
                value={editedProfile.bio}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, bio: text })}
                placeholder="Enter bio"
                placeholderTextColor={useThemeColor({}, 'placeholder')}
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Avatar URL</ThemedText>
              <TextInput
                style={[themedStyles.input, { color: textColor }]}
                value={editedProfile.avatar}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, avatar: text })}
                placeholder="Enter avatar URL"
                placeholderTextColor={useThemeColor({}, 'placeholder')}
              />
            </ThemedView>

            <ThemedView style={themedStyles.section}>
              <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Social Links</ThemedText>
              <TextInput
                style={themedStyles.input}
                value={editedProfile.socialLinks.twitter || ""}
                onChangeText={(text) => setEditedProfile({
                  ...editedProfile,
                  socialLinks: { ...editedProfile.socialLinks, twitter: text }
                })}
                placeholder="Twitter URL"
                placeholderTextColor="#666"
              />
              <TextInput
                style={[themedStyles.input, themedStyles.socialInput]}
                value={editedProfile.socialLinks.github || ""}
                onChangeText={(text) => setEditedProfile({
                  ...editedProfile,
                  socialLinks: { ...editedProfile.socialLinks, github: text }
                })}
                placeholder="GitHub URL"
                placeholderTextColor="#666"
              />
              <TextInput
                style={[themedStyles.input, themedStyles.socialInput]}
                value={editedProfile.socialLinks.website || ""}
                onChangeText={(text) => setEditedProfile({
                  ...editedProfile,
                  socialLinks: { ...editedProfile.socialLinks, website: text }
                })}
                placeholder="Website URL"
                placeholderTextColor="#666"
              />
            </ThemedView>

            <View style={themedStyles.buttonContainer}>
              <TouchableOpacity
                onPress={updateProfile}
                style={[themedStyles.menuButton, themedStyles.fullWidthButton, loading && themedStyles.disabledButton]}
                disabled={loading}
              >
                <ThemedText style={themedStyles.buttonText}>
                  {loading ? "Saving..." : "Save Changes"}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsEditing(false);
                  setEditedProfile(profile || editedProfile);
                }}
                style={[themedStyles.menuButton, themedStyles.secondaryButton, themedStyles.fullWidthButton]}
              >
                <ThemedText style={themedStyles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={themedStyles.mainContainer}>
            <ThemedView style={themedStyles.section}>
              <View style={themedStyles.profileHeader}>
                {profile?.avatar && (
                  <Image
                    source={{ uri: profile.avatar }}
                    style={themedStyles.avatar}
                  />
                )}
                <View style={themedStyles.profileInfo}>
                  <ThemedText type="title" style={themedStyles.displayName}>
                    {profile?.displayName || "Anonymous"}
                  </ThemedText>
                  <ThemedText style={themedStyles.addressText}>
                    {account?.bech32Address}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>

            {profile?.bio && (
              <ThemedView style={themedStyles.section}>
                <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Bio</ThemedText>
                <ThemedText style={themedStyles.bioText}>{profile.bio}</ThemedText>
              </ThemedView>
            )}

            {(profile?.socialLinks?.twitter || profile?.socialLinks?.github || profile?.socialLinks?.website) && (
              <ThemedView style={themedStyles.section}>
                <ThemedText type="defaultSemiBold" style={themedStyles.sectionTitle}>Social Links</ThemedText>
                {profile.socialLinks.twitter && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(profile.socialLinks.twitter!)}
                    style={themedStyles.socialLink}
                  >
                    <ThemedText style={themedStyles.socialLinkText}>Twitter</ThemedText>
                  </TouchableOpacity>
                )}
                {profile.socialLinks.github && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(profile.socialLinks.github!)}
                    style={themedStyles.socialLink}
                  >
                    <ThemedText style={themedStyles.socialLinkText}>GitHub</ThemedText>
                  </TouchableOpacity>
                )}
                {profile.socialLinks.website && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(profile.socialLinks.website!)}
                    style={themedStyles.socialLink}
                  >
                    <ThemedText style={themedStyles.socialLinkText}>Website</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
            )}

            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={[themedStyles.menuButton, themedStyles.fullWidthButton]}
            >
              <ThemedText style={themedStyles.buttonText}>Edit Profile</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
} 