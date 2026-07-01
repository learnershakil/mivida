import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, TrendingDown, Trash2 } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { useState, useEffect, useMemo } from 'react';
import { database } from '../../database';
import FinanceLog from '../../database/models/FinanceLog';
import User from '../../database/models/User';
import { AddFinanceModal } from '../../components/AddFinanceModal';
import { initializeUser } from '../../services/userService';

interface FinanceScreenProps {
   logs: FinanceLog[];
   users: User[];
}

// Category colors for chart
const CATEGORY_COLORS = [
   '#4AC3FF', // blue
   '#C0F67F', // green
   '#FFD465', // yellow
   '#D8C8FE', // purple
   '#FF8E6E', // orange
   '#52525b', // gray (other)
];

const FinanceScreen = ({ logs, users }: FinanceScreenProps) => {
   const [showAddFinance, setShowAddFinance] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
   const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
   const [selectedTransaction, setSelectedTransaction] = useState<FinanceLog | null>(null);
   const [showExpenseDetails, setShowExpenseDetails] = useState(false);

   const user = users[0];
   const userId = user?.id || 'local_user';

   // Filter logs by time range - all date calculations inside useMemo
   const { filteredByTime, now } = useMemo(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();

      // Week range (Sunday to Saturday)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);

      // Month range
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Year range
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      const startDate = timeRange === 'week' ? startOfWeek : timeRange === 'month' ? startOfMonth : startOfYear;
      const endDate = timeRange === 'week' ? endOfWeek : timeRange === 'month' ? endOfMonth : endOfYear;

      const filtered = logs.filter(log => {
         const logDate = new Date(log.transactionDate);
         return logDate >= startDate && logDate <= endDate;
      });

      return { filteredByTime: filtered, now };
   }, [logs, timeRange]);

   // Calculate totals from filtered logs
   const totalIncome = filteredByTime
      .filter(log => log.type === 'INCOME')
      .reduce((acc, log) => acc + log.amount, 0);

   const totalExpense = filteredByTime
      .filter(log => log.type === 'EXPENSE')
      .reduce((acc, log) => acc + log.amount, 0);

   const totalBalance = totalIncome - totalExpense;

   // Calculate expense categories for chart
   const expenseCategories = useMemo(() => {
      const categories: Record<string, number> = {};
      filteredByTime
         .filter(log => log.type === 'EXPENSE')
         .forEach(log => {
            const cat = log.category || 'Other';
            categories[cat] = (categories[cat] || 0) + log.amount;
         });

      const sortedCategories = Object.entries(categories)
         .sort((a, b) => b[1] - a[1])
         .slice(0, 5);

      // Calculate "Other" for remaining categories
      const topTotal = sortedCategories.reduce((sum, [, amount]) => sum + amount, 0);
      const otherAmount = totalExpense - topTotal;
      if (otherAmount > 0) {
         sortedCategories.push(['Other', otherAmount]);
      }

      return sortedCategories.map(([name, amount], index) => ({
         name,
         amount,
         percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
         color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
   }, [filteredByTime, totalExpense]);

   // Filter logs by type
   const filteredLogs = filteredByTime.filter(log => {
      if (filter === 'all') return true;
      if (filter === 'income') return log.type === 'INCOME';
      if (filter === 'expense') return log.type === 'EXPENSE';
      return true;
   });

   // Format date
   const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
   };

   // Format currency
   const formatCurrency = (amount: number) => {
      return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
   };

   // Delete transaction
   const handleDeleteTransaction = async (transaction: FinanceLog) => {
      Alert.alert(
         'Delete Transaction',
         `Are you sure you want to delete this ${transaction.type.toLowerCase()} of ${formatCurrency(transaction.amount)}?`,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  try {
                     await database.write(async () => {
                        await transaction.markAsDeleted();
                     });
                     setSelectedTransaction(null);
                  } catch (error) {
                     console.error('Failed to delete transaction:', error);
                     Alert.alert('Error', 'Failed to delete transaction');
                  }
               },
            },
         ]
      );
   };

   // Get current month name
   const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });
   const currentYear = now.getFullYear();

   useEffect(() => {
      async function init() {
         try {
            await initializeUser();
         } catch (error) {
            console.error('Init error:', error);
         } finally {
            setIsLoading(false);
         }
      }
      init();
   }, []);

   if (isLoading) {
      return (
         <View className="flex-1 bg-gray-50 items-center justify-center">
            <ActivityIndicator size="large" color="#1E1E1E" />
         </View>
      );
   }

   // Calculate the largest expense percentage for center display
   const largestExpensePercent = expenseCategories.length > 0 ? expenseCategories[0].percentage : 0;

   return (
      <View className="flex-1 bg-gray-50">
         <StatusBar style="dark" />
         <SafeAreaView className="flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
               {/* --- PREMIUM VISA CARD --- */}
               <View className="px-6 mb-8 mt-8">
                  <View className="w-full h-56 bg-[#1c1c1e] rounded-[32px] p-7 justify-between border border-white/10 shadow-2xl shadow-black">
                     {/* Card Top */}
                     <View className="flex-row justify-between items-start">
                        <View>
                           <Text className="text-white font-bold text-xl italic tracking-tighter">VISA</Text>
                           <Text className="text-white/40 text-[10px] uppercase font-bold mt-1">Debit Card</Text>
                        </View>
                        {/* Chip Simulation */}
                        <View className="flex-row items-center gap-1">
                           <View className="h-8 w-10 rounded-md bg-[#FFD465]/20 border border-[#FFD465]/50 flex-row items-center justify-center gap-[2px]">
                              <View className="h-full w-[1px] bg-[#FFD465]/30" />
                              <View className="h-[80%] w-[1px] bg-[#FFD465]/30" />
                              <View className="h-full w-[1px] bg-[#FFD465]/30" />
                           </View>
                           <View className="flex-row">
                              <View className="h-3 w-3 rounded-full bg-white/20 -mr-1" />
                              <View className="h-3 w-3 rounded-full bg-white/40" />
                           </View>
                        </View>
                     </View>

                     {/* Card Balance */}
                     <View>
                        <Text className="text-white/50 text-xs font-medium mb-1">Total Balance</Text>
                        <Text className="text-white text-[40px] font-bold tracking-tight">
                           {formatCurrency(totalBalance)}
                        </Text>
                     </View>

                     {/* Card Bottom */}
                     <View className="flex-row justify-between items-center">
                        <Text className="text-white/70 text-lg tracking-widest font-medium">•••• 5419</Text>
                        <View className="flex-row gap-4">
                           <View>
                              <Text className="text-white/20 text-[8px] uppercase font-bold">Exp</Text>
                              <Text className="text-white/80 text-xs font-bold">07 / 23</Text>
                           </View>
                           <View>
                              <Text className="text-white/20 text-[8px] uppercase font-bold">Cvv</Text>
                              <Text className="text-white/80 text-xs font-bold">•••</Text>
                           </View>
                        </View>
                     </View>
                  </View>
               </View>

               {/* --- FILTER SECTION --- */}
               <View className="px-6 flex-row justify-between items-center mb-8">
                  <View className="flex-row items-center gap-2">
                     <View className="h-2.5 w-2.5 rounded-full bg-[#FF8E6E]" />
                     <Text className="text-black font-bold text-lg">Expenses</Text>
                  </View>

                  {/* Toggle Switch */}
                  <View style={styles.timeToggleContainer}>
                     <TouchableOpacity
                        onPress={() => setTimeRange('week')}
                        style={[styles.timeToggleTab, timeRange === 'week' && styles.timeToggleActive]}
                     >
                        <Text style={[styles.timeToggleText, timeRange === 'week' && styles.timeToggleTextActive]}>Week</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setTimeRange('month')}
                        style={[styles.timeToggleTab, timeRange === 'month' && styles.timeToggleActive]}
                     >
                        <Text style={[styles.timeToggleText, timeRange === 'month' && styles.timeToggleTextActive]}>Month</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setTimeRange('year')}
                        style={[styles.timeToggleTab, timeRange === 'year' && styles.timeToggleActive]}
                     >
                        <Text style={[styles.timeToggleText, timeRange === 'year' && styles.timeToggleTextActive]}>Year</Text>
                     </TouchableOpacity>
                  </View>
               </View>

               {/* --- EXPENSES CHART SECTION --- */}
               <View className="px-6 flex-row gap-4 mb-8">
                  {/* Left: SVG Donut Chart - Long press for details */}
                  <Pressable
                     onLongPress={() => setShowExpenseDetails(true)}
                     delayLongPress={400}
                     className="flex-1 bg-white p-5 rounded-[32px] items-center justify-center border border-black/5 min-h-[160px]"
                  >
                     <View className="relative items-center justify-center">
                        <Svg width={112} height={112} viewBox="0 0 100 100">
                           <G rotation="-90" origin="50, 50">
                              {expenseCategories.length === 0 ? (
                                 <Circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    stroke="#F3F4F6"
                                    strokeWidth="14"
                                    fill="none"
                                 />
                              ) : (
                                 expenseCategories.map((cat, index) => {
                                    const circumference = 2 * Math.PI * 40;
                                    const strokeDasharray = circumference;
                                    const strokeDashoffset = circumference * (1 - cat.percentage / 100);

                                    // Calculate rotation for this segment
                                    const previousPercentage = expenseCategories
                                       .slice(0, index)
                                       .reduce((sum, c) => sum + c.percentage, 0);
                                    const rotation = (previousPercentage / 100) * 360;

                                    return (
                                       <Circle
                                          key={cat.name}
                                          cx="50"
                                          cy="50"
                                          r="40"
                                          stroke={cat.color}
                                          strokeWidth="14"
                                          fill="none"
                                          strokeDasharray={strokeDasharray}
                                          strokeDashoffset={strokeDashoffset}
                                          rotation={rotation}
                                          origin="50, 50"
                                          strokeLinecap="butt"
                                       />
                                    );
                                 })
                              )}
                           </G>
                        </Svg>
                        <View className="absolute">
                           <Text className="text-black text-2xl font-bold">{largestExpensePercent}%</Text>
                        </View>
                     </View>
                     <Text className="text-zinc-400 text-[10px] mt-2">Hold for details</Text>
                  </Pressable>

                  {/* Right: Quick Summary */}
                  <View className="flex-1 justify-center gap-2 pl-2">
                     <Text className="text-black text-lg font-bold">
                        {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? currentMonthName : currentYear.toString()}
                     </Text>
                     <View className="bg-red-50 rounded-2xl p-3">
                        <Text className="text-red-400 text-xs mb-1">Total Spent</Text>
                        <Text className="text-red-600 text-xl font-bold">{formatCurrency(totalExpense)}</Text>
                     </View>
                     {expenseCategories.length > 0 && (
                        <View className="flex-row items-center gap-2 mt-1">
                           <View className="h-2 w-2 rounded-full" style={{ backgroundColor: expenseCategories[0].color }} />
                           <Text className="text-zinc-500 text-xs">Top: {expenseCategories[0].name}</Text>
                        </View>
                     )}
                  </View>
               </View>

               {/* --- INCOME GRAPH SECTION --- */}
               <View className="px-6">
                  <View className="flex-row justify-between items-center mb-6">
                     <View className="flex-row items-center gap-2">
                        <View className="h-2.5 w-2.5 rounded-full bg-[#C0F67F]" />
                        <Text className="text-black font-bold text-lg">Income</Text>
                     </View>
                     <View className="flex-row items-center gap-2 bg-[#C0F67F] px-3 py-1.5 rounded-full">
                        <ArrowUpRight size={14} color="black" />
                        <Text className="text-black font-bold text-xs">
                           {formatCurrency(totalIncome)}
                        </Text>
                     </View>
                  </View>

                  {/* Summary Cards */}
                  <View className="flex-row gap-3 mb-6">
                     <View className="flex-1 bg-white rounded-[24px] p-4 border border-black/5">
                        <View className="flex-row items-center gap-2 mb-2">
                           <TrendingUp size={18} color="#22C55E" />
                           <Text className="text-gray-500 text-xs">Income</Text>
                        </View>
                        <Text className="text-black text-xl font-bold pl-8">
                           {formatCurrency(totalIncome)}
                        </Text>
                     </View>
                     <View className="flex-1 bg-white rounded-[24px] p-4 border border-black/5">
                        <View className="flex-row items-center gap-2 mb-2">
                           <TrendingDown size={18} color="#EF4444" />
                           <Text className="text-gray-500 text-xs">Expense</Text>
                        </View>
                        <Text className="text-black text-xl font-bold pl-8">
                           {formatCurrency(totalExpense)}
                        </Text>
                     </View>
                  </View>

                  {/* Filter Tabs */}
                  <View style={styles.filterContainer}>
                     <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                     >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                           All
                        </Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setFilter('income')}
                        style={[styles.filterTab, filter === 'income' && styles.filterTabActive]}
                     >
                        <Text style={[styles.filterText, filter === 'income' && styles.filterTextActive]}>
                           Income
                        </Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setFilter('expense')}
                        style={[styles.filterTab, filter === 'expense' && styles.filterTabActive]}
                     >
                        <Text style={[styles.filterText, filter === 'expense' && styles.filterTextActive]}>
                           Expense
                        </Text>
                     </TouchableOpacity>
                  </View>

                  {/* Transaction List */}
                  <View className="bg-white rounded-[32px] p-4 border border-black/5 mb-6">
                     <Text className="text-black font-bold text-lg mb-4">Recent Transactions</Text>

                     {filteredLogs.length === 0 ? (
                        <View className="py-8 items-center">
                           <Text className="text-5xl mb-3">💰</Text>
                           <Text className="text-gray-500 text-center">
                              No transactions yet.{'\n'}Tap + to add one.
                           </Text>
                        </View>
                     ) : (
                        <View className="gap-3">
                           {filteredLogs.slice(0, 10).map((log) => (
                              <TouchableOpacity
                                 key={log.id}
                                 className="flex-row items-center justify-between py-3 border-b border-gray-50"
                                 onPress={() => setSelectedTransaction(selectedTransaction?.id === log.id ? null : log)}
                                 onLongPress={() => handleDeleteTransaction(log)}
                                 delayLongPress={500}
                              >
                                 <View className="flex-row items-center gap-3 flex-1">
                                    <View className={`h-10 w-10 rounded-full items-center justify-center ${log.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                                       }`}>
                                       {log.type === 'INCOME' ? (
                                          <ArrowDownLeft size={18} color="#22C55E" />
                                       ) : (
                                          <ArrowUpRight size={18} color="#EF4444" />
                                       )}
                                    </View>
                                    <View className="flex-1">
                                       <Text className="text-black font-medium">{log.category || 'Uncategorized'}</Text>
                                       <Text className="text-gray-400 text-xs">{formatDate(new Date(log.transactionDate))}</Text>
                                       {selectedTransaction?.id === log.id && (
                                          <View className="mt-2">
                                             {log.description && (
                                                <Text className="text-gray-500 text-xs mb-1">{log.description}</Text>
                                             )}
                                             {log.source && (
                                                <Text className="text-gray-400 text-xs">Source: {log.source}</Text>
                                             )}
                                             {log.destination && (
                                                <Text className="text-gray-400 text-xs">To: {log.destination}</Text>
                                             )}
                                          </View>
                                       )}
                                    </View>
                                 </View>
                                 <View className="flex-row items-center gap-2">
                                    <Text className={`font-bold ${log.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                                       {log.type === 'INCOME' ? '+' : '-'}{formatCurrency(log.amount)}
                                    </Text>
                                    {selectedTransaction?.id === log.id && (
                                       <TouchableOpacity
                                          onPress={() => handleDeleteTransaction(log)}
                                          className="p-2"
                                       >
                                          <Trash2 size={16} color="#EF4444" />
                                       </TouchableOpacity>
                                    )}
                                 </View>
                              </TouchableOpacity>
                           ))}
                        </View>
                     )}
                  </View>
               </View>

            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
               onPress={() => setShowAddFinance(true)}
               className="absolute bottom-32 right-6 h-14 w-14 bg-black rounded-full items-center justify-center shadow-lg shadow-black/30"
            >
               <Plus size={24} color="white" />
            </TouchableOpacity>

            {/* Add Finance Modal */}
            <AddFinanceModal
               visible={showAddFinance}
               onClose={() => setShowAddFinance(false)}
               userId={userId}
            />

            {/* Expense Details Modal */}
            <Modal
               visible={showExpenseDetails}
               transparent
               animationType="fade"
               onRequestClose={() => setShowExpenseDetails(false)}
            >
               <Pressable
                  style={styles.modalOverlay}
                  onPress={() => setShowExpenseDetails(false)}
               >
                  <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                     <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Expense Breakdown</Text>
                        <Text style={styles.modalSubtitle}>
                           {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? currentMonthName : currentYear.toString()}
                        </Text>
                     </View>

                     {/* Large Donut Chart */}
                     <View style={styles.modalChartContainer}>
                        <Svg width={180} height={180} viewBox="0 0 100 100">
                           <G rotation="-90" origin="50, 50">
                              {expenseCategories.length === 0 ? (
                                 <Circle cx="50" cy="50" r="40" stroke="#F3F4F6" strokeWidth="12" fill="none" />
                              ) : (
                                 expenseCategories.map((cat, index) => {
                                    const circumference = 2 * Math.PI * 40;
                                    const strokeDashoffset = circumference * (1 - cat.percentage / 100);
                                    const previousPercentage = expenseCategories.slice(0, index).reduce((sum, c) => sum + c.percentage, 0);
                                    const rotation = (previousPercentage / 100) * 360;
                                    return (
                                       <Circle
                                          key={cat.name}
                                          cx="50" cy="50" r="40"
                                          stroke={cat.color}
                                          strokeWidth="12"
                                          fill="none"
                                          strokeDasharray={circumference}
                                          strokeDashoffset={strokeDashoffset}
                                          rotation={rotation}
                                          origin="50, 50"
                                          strokeLinecap="butt"
                                       />
                                    );
                                 })
                              )}
                           </G>
                        </Svg>
                        <View style={styles.modalChartCenter}>
                           <Text style={styles.modalChartTotal}>{formatCurrency(totalExpense)}</Text>
                           <Text style={styles.modalChartLabel}>Total</Text>
                        </View>
                     </View>

                     {/* Category List */}
                     <View style={styles.categoryList}>
                        {expenseCategories.length === 0 ? (
                           <Text style={styles.noDataText}>No expenses recorded</Text>
                        ) : (
                           expenseCategories.map((cat) => (
                              <View key={cat.name} style={styles.categoryRow}>
                                 <View style={styles.categoryLeft}>
                                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.categoryName}>{cat.name}</Text>
                                 </View>
                                 <View style={styles.categoryRight}>
                                    <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
                                    <Text style={styles.categoryPercent}>{cat.percentage}%</Text>
                                 </View>
                              </View>
                           ))
                        )}
                     </View>

                     {/* Close Button */}
                     <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowExpenseDetails(false)}
                     >
                        <Text style={styles.closeButtonText}>Close</Text>
                     </TouchableOpacity>
                  </Pressable>
               </Pressable>
            </Modal>
         </SafeAreaView>
      </View>
   );
}

const enhance = withObservables([], () => ({
   logs: database.get<FinanceLog>('finance_logs').query(
      Q.sortBy('created_at', Q.desc)
   ).observe(),
   users: database.get<User>('users').query().observe(),
}));

const EnhancedFinanceScreen = enhance(FinanceScreen);

export default function FinanceScreenWrapper() {
   return <EnhancedFinanceScreen logs={[]} users={[]} />;
}

const styles = StyleSheet.create({
   // Time Toggle Styles
   timeToggleContainer: {
      flexDirection: 'row',
      backgroundColor: '#E5E7EB',
      borderRadius: 50,
      padding: 4,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
   },
   timeToggleTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 50,
   },
   timeToggleActive: {
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
   },
   timeToggleText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'rgba(0,0,0,0.4)',
   },
   timeToggleTextActive: {
      color: '#000',
   },
   // Filter Tab Styles
   filterContainer: {
      flexDirection: 'row',
      backgroundColor: '#F3F4F6',
      borderRadius: 50,
      padding: 4,
      marginBottom: 24,
   },
   filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 50,
      alignItems: 'center',
   },
   filterTabActive: {
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
   },
   filterText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#9CA3AF',
   },
   filterTextActive: {
      color: '#000',
   },
   // Modal Styles
   modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
   },
   modalContent: {
      backgroundColor: 'white',
      borderRadius: 32,
      padding: 24,
      width: '100%',
      maxWidth: 360,
   },
   modalHeader: {
      alignItems: 'center',
      marginBottom: 20,
   },
   modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#000',
   },
   modalSubtitle: {
      fontSize: 14,
      color: '#9CA3AF',
      marginTop: 4,
   },
   modalChartContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      position: 'relative',
   },
   modalChartCenter: {
      position: 'absolute',
      alignItems: 'center',
   },
   modalChartTotal: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#000',
   },
   modalChartLabel: {
      fontSize: 12,
      color: '#9CA3AF',
   },
   categoryList: {
      gap: 12,
   },
   categoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
   },
   categoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
   },
   categoryDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
   },
   categoryName: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
   },
   categoryRight: {
      alignItems: 'flex-end',
   },
   categoryAmount: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#000',
   },
   categoryPercent: {
      fontSize: 12,
      color: '#9CA3AF',
   },
   noDataText: {
      textAlign: 'center',
      color: '#9CA3AF',
      paddingVertical: 20,
   },
   closeButton: {
      backgroundColor: '#1c1c1e',
      borderRadius: 50,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 24,
   },
   closeButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
   },
});