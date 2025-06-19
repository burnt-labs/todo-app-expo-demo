import { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Alert, TextInput, ScrollView, Clipboard, Linking, RefreshControl, ActivityIndicator } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import type { ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useThemeColor } from '@/hooks/useThemeColor';

type RootStackParamList = {
  index: { refresh?: number };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'index'>;

if (!process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS) {
  throw new Error("EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS is not set in your environment file");
}

type ExecuteResultOrUndefined = ExecuteResult | undefined;
type QueryResult = {
  users?: string[];
  value?: string;
  map?: Array<[string, string]>;
};

type Todo = {
  id: string;
  title: string;
  text: string;
  completed: boolean;
  created_at: string;
};

type TodoSummary = {
  total: number;
  completed: number;
  pending: number;
};

// Add retry utility function
const sleep = (ms: number): Promise<void> => new Promise((resolve: () => void) => setTimeout(resolve, ms));

const retryOperation = async <T,>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, error);
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i)); // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

export default function Index() {
  // Theme color hooks - all at top level
  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const inputColor = useThemeColor({}, 'input');
  const inputTextColor = useThemeColor({}, 'inputText');
  const placeholderColor = useThemeColor({}, 'placeholder');
  const buttonColor = useThemeColor({}, 'button');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const disabledColor = useThemeColor({}, 'disabled');
  const errorColor = useThemeColor({}, 'error');
  const tintColor = useThemeColor({}, 'tint');

  // Abstraxion hooks - always call them unconditionally
  const abstraxionAccount = useAbstraxionAccount();
  const abstraxionSigningClient = useAbstraxionSigningClient();
  const abstraxionClient = useAbstraxionClient();
  const navigation = useNavigation<NavigationProp>();

  // Destructure with fallbacks to ensure stable references
  const { data: account, logout, login, isConnected, isConnecting } = abstraxionAccount || {};
  const { client } = abstraxionSigningClient || {};
  const { client: queryClient } = abstraxionClient || {};

  // State variables
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<{ type: 'complete' | 'delete', id: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [summary, setSummary] = useState<TodoSummary>({ total: 0, completed: 0, pending: 0 });
  const [newTodoText, setNewTodoText] = useState<string>("");

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert("Success", "Address copied to clipboard!");
    } catch (error) {
      Alert.alert("Error", "Failed to copy address");
    }
  };

  // Fetch todos
  const fetchTodos = async () => {
    if (!queryClient || !account) {
      console.log("Cannot fetch todos - missing queryClient or account:", { 
        hasQueryClient: !!queryClient, 
        hasAccount: !!account,
        accountAddress: account?.bech32Address 
      });
      return;
    }
    
    const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;
    console.log("Fetching todos with contract address:", contractAddress);
    
    try {
      console.log("Querying contract with params:", {
        owner: account.bech32Address,
        collection: "todos"
      });
      
      const response = await queryClient.queryContractSmart(contractAddress, {
        UserDocuments: {
          owner: account.bech32Address,
          collection: "todos"
        }
      });
      
      console.log("Raw response from contract:", response);
      
      if (response?.documents) {
        console.log("Documents found:", response.documents);
        const todosList = response.documents.map(([id, doc]: [string, any]) => {
          const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          console.log("Processing todo:", { id, data });
          return {
            id,
            title: data.title,
            text: data.text,
            completed: data.completed,
            created_at: data.created_at
          } as Todo;
        });

        // Sort todos by creation date in descending order (newest first)
        const sortedTodos = todosList.sort((a: Todo, b: Todo) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        
        console.log("Final sorted todos:", sortedTodos);
        setTodos(sortedTodos);
        
        // Update summary
        const completed = sortedTodos.filter((t: Todo) => t.completed).length;
        setSummary({
          total: sortedTodos.length,
          completed,
          pending: sortedTodos.length - completed
        });
      } else {
        console.log("No documents found in response");
        setTodos([]);
        setSummary({ total: 0, completed: 0, pending: 0 });
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      setTodos([]);
      setSummary({ total: 0, completed: 0, pending: 0 });
    }
  };

  // Toggle todo completion
  const toggleTodo = async (todo: Todo) => {
    if (!client || !account) return;
    
    const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;
    
    setLoadingAction({ type: 'complete', id: todo.id });
    try {
      const updatedTodo = {
        ...todo,
        completed: !todo.completed
      };

      await client.execute(
        account.bech32Address,
        contractAddress,
        {
          Update: {
            collection: "todos",
            document: todo.id,
            data: JSON.stringify(updatedTodo)
          }
        },
        "auto"
      );
      
      // Update local state
      setTodos(todos.map(t => t.id === todo.id ? updatedTodo : t));
      // Update summary
      const completed = todos.filter(t => t.id === todo.id ? updatedTodo.completed : t.completed).length;
      setSummary({
        total: todos.length,
        completed,
        pending: todos.length - completed
      });
    } catch (error) {
      console.error("Error toggling todo:", error);
      Alert.alert("Error", "Failed to update todo. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Delete todo
  const deleteTodo = async (todoId: string) => {
    if (!client || !account) return;
    
    const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;
    
    setLoadingAction({ type: 'delete', id: todoId });
    try {
      await client.execute(
        account.bech32Address,
        contractAddress,
        {
          Delete: {
            collection: "todos",
            document: todoId
          }
        },
        "auto"
      );
      
      // Update local state
      setTodos(todos.filter(t => t.id !== todoId));
      // Update summary
      const completed = todos.filter(t => t.id !== todoId && t.completed).length;
      setSummary({
        total: todos.length - 1,
        completed,
        pending: todos.length - 1 - completed
      });
    } catch (error) {
      console.error("Error deleting todo:", error);
      Alert.alert("Error", "Failed to delete todo. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Effect to fetch todos when account changes or refresh parameter changes
  useEffect(() => {
    console.log("Fetching todos - account changed, refresh triggered, or component mounted");
    if (account?.bech32Address) {
      fetchTodos();
    }
  }, [account?.bech32Address, navigation.getState().routes.find(r => r.name === 'index')?.params?.refresh]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTodos();
    setRefreshing(false);
  };

  // Add todo
  const addTodo = async () => {
    if (!client || !account || !newTodoText.trim() || !queryClient) return;
    
    const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;
    const todoId = Date.now().toString();
    const todo = {
      id: todoId,
      title: newTodoText.trim(),
      text: newTodoText.trim(),
      completed: false,
      created_at: new Date().toISOString()
    };
    
    setLoading(true);
    try {
      await client.execute(
        account.bech32Address,
        contractAddress,
        {
          Set: {
            collection: "todos",
            document: todoId,
            data: JSON.stringify(todo)
          }
        },
        "auto"
      );
      
      // Wait for confirmation
      let retries = 0;
      const maxRetries = 10;
      const delay = 2000;
      
      while (retries < maxRetries) {
        try {
          const response = await queryClient.queryContractSmart(contractAddress, {
            UserDocuments: {
              owner: account.bech32Address,
              collection: "todos"
            }
          });
          
          if (response?.documents) {
            const found = response.documents.some(([id]: [string, any]) => id === todoId);
            if (found) {
              break;
            }
          }
        } catch (error) {
          console.log(`Attempt ${retries + 1} failed:`, error);
        }
        
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      setNewTodoText("");
      // Always fetch the latest todos after adding
      await fetchTodos();
    } catch (error) {
      console.error("Error adding todo:", error);
      Alert.alert("Error", "Failed to add todo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ThemedText type="title" style={styles.title}>Todo List</ThemedText>

      {!isConnected ? (
        <View style={styles.connectButtonContainer}>
          <TouchableOpacity
            onPress={login}
            style={[
              styles.menuButton,
              styles.fullWidthButton,
              isConnecting && styles.disabledButton,
              { backgroundColor: buttonColor }
            ]}
            disabled={isConnecting}
          >
            <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Summary Section */}
          <View style={styles.section}>
            <View style={[styles.summaryContainer, { backgroundColor: cardColor }]}>
              <View style={styles.statItem}>
                <ThemedText type="title">{summary.total}</ThemedText>
                <ThemedText style={styles.statLabel}>Total</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="title">{summary.completed}</ThemedText>
                <ThemedText style={styles.statLabel}>Completed</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="title">{summary.pending}</ThemedText>
                <ThemedText style={styles.statLabel}>Pending</ThemedText>
              </View>
            </View>
          </View>

          {/* Add Todo Form */}
          <View style={styles.section}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputColor,
                  color: inputTextColor,
                  borderColor: borderColor
                }
              ]}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="Enter todo text"
              placeholderTextColor={placeholderColor}
              editable={!loading && !loadingAction}
            />
            <TouchableOpacity
              onPress={addTodo}
              style={[
                styles.menuButton,
                styles.fullWidthButton,
                (!newTodoText.trim() || loading || !!loadingAction) && styles.disabledButton,
                { backgroundColor: buttonColor }
              ]}
              disabled={!newTodoText.trim() || loading || !!loadingAction}
            >
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                {loading ? "Adding..." : "Add Todo"}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Todo List */}
          <View style={styles.section}>
            {todos.length === 0 ? (
              <ThemedText style={styles.emptyText}>No todos yet. Add one above!</ThemedText>
            ) : (
              todos.map((todo) => (
                <View 
                  key={todo.id} 
                  style={[
                    styles.todoItem, 
                    { 
                      backgroundColor: cardColor,
                      borderWidth: 1,
                      borderColor: borderColor
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.todoContent}
                    onPress={() => toggleTodo(todo)}
                    disabled={!!loadingAction}
                  >
                    <View style={[
                      styles.checkbox,
                      { borderColor: borderColor },
                      todo.completed && styles.checkboxChecked
                    ]}>
                      {todo.completed && (
                        <IconSymbol name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.todoText,
                        todo.completed && styles.todoTextCompleted
                      ]}
                    >
                      {todo.text}
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteTodo(todo.id)}
                    style={styles.deleteButton}
                    disabled={!!loadingAction}
                  >
                    <IconSymbol name="trash.fill" size={24} color={errorColor} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}
      </ScrollView>
      
      {/* Global Loading Overlay */}
      {(loadingAction || loading) && (
        <View style={styles.globalLoadingOverlay}>
          <View style={[styles.loadingContent, { backgroundColor: cardColor }]}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={styles.loadingText}>
              {loading ? 'Adding...' : loadingAction?.type === 'complete' ? 'Updating...' : 'Deleting...'}
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    gap: 20,
  },
  section: {
    padding: 15,
    gap: 10,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 10,
    padding: 15,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    width: '100%',
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    position: 'relative',
  },
  todoContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
  },
  todoText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
  },
  todoTextCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 10,
  },
  connectButtonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  menuButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyText: {
    textAlign: "center",
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  globalLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 150,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});
