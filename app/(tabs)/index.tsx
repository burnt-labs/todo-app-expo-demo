import { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Alert, TextInput, ScrollView, Clipboard, Linking, RefreshControl } from "react-native";
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

type RootStackParamList = {
  index: { refresh?: number };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'index'>;

if (!process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS) {
  throw new Error("EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS is not set in your environment file");
}

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
  // Abstraxion hooks
  const { data: account, logout, login, isConnected, isConnecting } = useAbstraxionAccount();
  const { client } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();
  const navigation = useNavigation<NavigationProp>();

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
    if (!queryClient || !account) return;
    
    const contractAddress = process.env.EXPO_PUBLIC_DOCUSTORE_CONTRACT_ADDRESS as string;
    
    try {
      const response = await queryClient.queryContractSmart(contractAddress, {
        UserDocuments: {
          owner: account.bech32Address,
          collection: "todos"
        }
      });
      
      if (response?.documents) {
        const todosList = response.documents.map(([id, doc]: [string, any]) => {
          const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
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
        
        console.log("Sorted todos:", sortedTodos.map((t: Todo) => ({ id: t.id, created_at: t.created_at })));
        setTodos(sortedTodos);
        
        // Update summary
        const completed = sortedTodos.filter((t: Todo) => t.completed).length;
        setSummary({
          total: sortedTodos.length,
          completed,
          pending: sortedTodos.length - completed
        });
      } else {
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
    console.log("Account changed or refresh triggered, fetching todos");
    if (account?.bech32Address) {
      fetchTodos();
    }
  }, [account?.bech32Address, navigation.getState().routes.find(r => r.name === 'index')?.params?.refresh]);

  // Also fetch todos when the component mounts
  useEffect(() => {
    console.log("Component mounted, fetching todos");
    if (account?.bech32Address) {
      fetchTodos();
    }
  }, []);

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
            style={[styles.menuButton, styles.fullWidthButton, isConnecting && styles.disabledButton]}
            disabled={isConnecting}
          >
            <ThemedText style={styles.buttonText}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Summary Section */}
          <View style={styles.section}>
            <View style={styles.summaryContainer}>
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
              style={styles.input}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="Enter todo text"
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              onPress={addTodo}
              style={[styles.menuButton, styles.fullWidthButton, (!newTodoText.trim() || loading) && styles.disabledButton]}
              disabled={!newTodoText.trim() || loading}
            >
              <ThemedText style={styles.buttonText}>
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
                <View key={todo.id} style={styles.todoItem}>
                  <TouchableOpacity
                    style={styles.todoContent}
                    onPress={() => toggleTodo(todo)}
                  >
                    <View style={[styles.checkbox, todo.completed && styles.checkboxChecked]}>
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
                  >
                    <IconSymbol name="trash.fill" size={24} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
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
    gap: 10,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
    backgroundColor: "#fff",
    width: '100%',
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
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
    borderColor: "#ddd",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
  },
  todoText: {
    flex: 1,
    fontSize: 16,
    color: "#11181C",
    marginLeft: 10,
  },
  todoTextCompleted: {
    textDecorationLine: "line-through",
    color: "#666666",
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
    backgroundColor: "#2196F3",
    alignItems: "center",
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
  emptyText: {
    textAlign: "center",
    color: "#666",
  },
});
