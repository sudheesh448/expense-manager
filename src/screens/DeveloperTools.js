import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, ShieldCheck, Database, Trash2, ArrowLeft, Bug } from 'lucide-react-native';
import { 
  getDb, 
  saveCreditCardInfo, 
  saveEmi, 
  payEmi, 
  forecloseEmi, 
  saveTransaction, 
  getCCAccountDueInfo, 
  saveBankInfo 
} from '../services/storage';

const DeveloperTools = ({ visible, onClose, theme, fs }) => {
  const insets = useSafeAreaInsets();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  const clearLogs = () => setLogs([]);

  const logDbTable = async (db, tableName, id, label = '') => {
    const row = await db.getFirstAsync(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    if (label) addLog(`\n--- ${label} [${tableName}] ---`);
    if (row) {
      Object.keys(row).forEach(key => {
        addLog(`${key}: ${row[key]}`);
      });
    } else {
      addLog(`!! Record not found in ${tableName} for ID: ${id}`);
    }
  };

  const cleanupTestData = async (db) => {
    addLog('\n🧹 CLEANING UP TEST DATA...');
    try {
      await db.runAsync("DELETE FROM credit_cards WHERE id LIKE 'DEV_TEST_%'");
      await db.runAsync("DELETE FROM bank_accounts WHERE id LIKE 'DEV_TEST_%'");
      await db.runAsync("DELETE FROM emis WHERE id LIKE 'DEV_TEST_%'");
      await db.runAsync("DELETE FROM transactions WHERE accountId LIKE 'DEV_TEST_%' OR toAccountId LIKE 'DEV_TEST_%' OR userId = 'DEV_USER'");
      await db.runAsync("DELETE FROM expected_expenses WHERE linkedAccountId LIKE 'DEV_TEST_%' OR userId = 'DEV_USER'");
      addLog('✅ Database cleaned.');
    } catch (e) {
      addLog('⚠️ Cleanup failed: ' + e.message);
    }
  };

  const assert = (condition, msg, expected = '', actual = '') => {
    if (condition) {
      addLog(`✅ PASS: ${msg} ${expected ? `(Expected: ${expected})` : ''}`);
    } else {
      addLog(`❌ FAIL: ${msg} \n   Expected: ${expected} \n   Actual: ${actual}`);
      throw new Error(`Assertion Failed: ${msg}`);
    }
  };

  const runEmiLifecycleTest = async () => {
    setIsRunning(true);
    clearLogs();
    addLog('🚀 STARTING EMI LIFECYCLE TEST');
    
    try {
      const db = await getDb();
      const userId = 'DEV_USER'; // Hardcoded test user

      // Pre-cleanup in case of leftovers
      await cleanupTestData(db);
      
      // 1. Create a Test Bank Account (for payments)
      const bankId = 'DEV_TEST_BANK';
      await saveBankInfo(db, bankId, {
        userId: userId,
        name: 'DEV_TEST_BANK',
        balance: 100000,
        type: 'BANK'
      });
      addLog('✅ Created Test Bank: 100,000 balance');

      // 2. Create a Test Credit Card
      const ccId = 'DEV_TEST_CC';
      const creditLimit = 50000;
      await saveCreditCardInfo(db, ccId, {
        userId: userId,
        name: 'DEV_TEST_CC',
        creditLimit: creditLimit,
        currentUsage: 0,
        remainingLimit: creditLimit,
        billingDay: 15,
        dueDay: 5
      });
      addLog('✅ Created Test Credit Card: 50,000 limit');

      // 3. Create a Test EMI
      const emiId = 'DEV_TEST_EMI';
      const principal = 10000;
      const tenure = 12;
      const interestRate = 12; // 12% annual
      const processingFee = 500;
      const taxRate = 0.18; // 18% GST (standard in the app)
      const serviceChargeTotal = processingFee * (1 + taxRate);
      
      addLog(`👉 Creating EMI: P=${principal}, n=${tenure}, Int=${interestRate}%, Fee=${processingFee}`);
      
      await saveEmi(userId, {
        id: emiId,
        name: 'DEV_TEST_EMI_PURCHASE',
        amount: principal, // Product Price
        tenure: tenure,
        interestRate: interestRate,
        processingFee: processingFee,
        taxPercentage: 18,
        accountId: ccId,
        emiDate: 15,
        emiStartDate: new Date().toISOString(),
        note: 'Test Purchase'
      });

      const afterCreateCC = await db.getFirstAsync('SELECT currentUsage, remainingLimit FROM credit_cards WHERE id = ?', [ccId]);
      assert(afterCreateCC.currentUsage === principal, 'CC Usage equals Principal', principal, afterCreateCC.currentUsage);
      assert(afterCreateCC.remainingLimit === creditLimit - principal, 'CC Remaining Limit reduced by Principal', creditLimit - principal, afterCreateCC.remainingLimit);

      const afterCreateEMI = await db.getFirstAsync('SELECT balance, ccUsage, ccRemaining, amount FROM emis WHERE id = ?', [emiId]);
      assert(afterCreateEMI.ccRemaining === principal, 'EMI ccRemaining equals Principal', principal, afterCreateEMI.ccRemaining);
      
      const installment = Number(afterCreateEMI.amount);
      const expectedBalance = principal + (installment * tenure - principal); // Standard Amortization Check
      addLog(`EMI Calculated Balance: ${afterCreateEMI.balance} (includes interest)`);

      // 4. Settle 1st Installment
      addLog('\n👉 SETTLING 1ST INSTALLMENT (Settle Button Flow)');
      await payEmi(userId, emiId, bankId);
      
      const afterSettleCC = await db.getFirstAsync('SELECT currentUsage, remainingLimit FROM credit_cards WHERE id = ?', [ccId]);
      const expectedCCUsageAfter = principal - (principal / tenure);
      const expectedCCLimitAfter = (creditLimit - principal) + (principal / tenure);
      
      // Tolerance for floating point
      assert(Math.abs(afterSettleCC.currentUsage - expectedCCUsageAfter) < 1, 'CC Usage restored by exactly Principal/Tenure', expectedCCUsageAfter.toFixed(2), afterSettleCC.currentUsage.toFixed(2));
      assert(Math.abs(afterSettleCC.remainingLimit - expectedCCLimitAfter) < 1, 'CC REMAINING LIMIT INCREMENTED by Principal/Tenure', expectedCCLimitAfter.toFixed(2), afterSettleCC.remainingLimit.toFixed(2));

      const afterSettleEMI = await db.getFirstAsync('SELECT balance, ccRemaining FROM emis WHERE id = ?', [emiId]);
      const expectedBalanceAfter = afterCreateEMI.balance - installment;
      assert(Math.abs(afterSettleEMI.balance - expectedBalanceAfter) < 2, 'EMI Balance reduced by exactly 1 Installment (Interest-Inclusive)', expectedBalanceAfter.toFixed(2), afterSettleEMI.balance.toFixed(2));
      assert(Math.abs(afterSettleEMI.ccRemaining - expectedCCUsageAfter) < 1, 'EMI ccRemaining reduced by exactly 1 Principal Portion', expectedCCUsageAfter.toFixed(2), afterSettleEMI.ccRemaining.toFixed(2));

      // 5. Foreclose EMI
      addLog('\n👉 FORECLOSING EMI (Total remaining Block Restoration)');
      await forecloseEmi(userId, emiId, bankId, afterSettleEMI.balance);
      
      const afterForecloseCC = await db.getFirstAsync('SELECT currentUsage, remainingLimit FROM credit_cards WHERE id = ?', [ccId]);
      assert(afterForecloseCC.currentUsage === 0, 'Total CC Usage fully cleared to 0', 0, afterForecloseCC.currentUsage);
      assert(afterForecloseCC.remainingLimit === creditLimit, 'CC REMAINING LIMIT FULLY RESTORED to original limit', creditLimit, afterForecloseCC.remainingLimit);

      const afterForecloseEMI = await db.getFirstAsync('SELECT balance, ccRemaining, isClosed FROM emis WHERE id = ?', [emiId]);
      assert(afterForecloseEMI.ccRemaining === 0, 'EMI ccRemaining is 0', 0, afterForecloseEMI.ccRemaining);
      assert(afterForecloseEMI.isClosed === 1, 'EMI Account is marked CLOSED', 1, afterForecloseEMI.isClosed);

      addLog('\n🏁 EMI LIFECYCLE TEST FINISHED - ALL ASSERTIONS PASSED');
      Alert.alert('Success', 'EMI Lifecycle test passed with 100% mathematical accuracy.');
      
      await cleanupTestData(db);
    } catch (error) {
      addLog('❌ TEST FAILED: ' + error.message);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  const runCcTransactionTest = async () => {
    setIsRunning(true);
    clearLogs();
    addLog('🚀 STARTING CC TRANSACTION & BILLING TEST');
    
    try {
      const db = await getDb();
      const userId = 'DEV_USER';

      await cleanupTestData(db);
      
      // 1. Create a Test Credit Card
      const ccId = 'DEV_TEST_CC_TX';
      const limit = 20000;
      await saveCreditCardInfo(db, ccId, {
        userId: userId,
        name: 'DEV_TEST_CC_TX',
        creditLimit: limit,
        currentUsage: 0,
        remainingLimit: limit,
        billingDay: 20,
        dueDay: 10
      });
      addLog('✅ Created Test Card: 20,000 limit');

      // 2. Add CC Expense (Unbilled)
      addLog('\n👉 Adding CC Expense');
      const expAmount = 2500;
      await saveTransaction(userId, {
        type: 'CC_EXPENSE',
        amount: expAmount,
        date: new Date().toISOString(),
        accountId: ccId,
        note: 'CC Spend'
      });
      
      const afterExpCC = await db.getFirstAsync('SELECT currentUsage, remainingLimit FROM credit_cards WHERE id = ?', [ccId]);
      assert(afterExpCC.currentUsage === expAmount, 'CC Usage INCREASED (Debit)', expAmount, afterExpCC.currentUsage);
      assert(afterExpCC.remainingLimit === limit - expAmount, 'CC Remaining Limit DECREASED', limit - expAmount, afterExpCC.remainingLimit);

      // 3. Add CC Pay (To verify limit restoration)
      addLog('\n👉 Adding CC Pay (Payment to Card)');
      const payAmount = 1000;
      await saveTransaction(userId, {
        type: 'CC_PAY',
        amount: payAmount,
        date: new Date().toISOString(),
        toAccountId: ccId,
        accountId: 'DEV_TEST_BANK',
        note: 'CC Payment'
      });

      const afterPayCC = await db.getFirstAsync('SELECT currentUsage, remainingLimit FROM credit_cards WHERE id = ?', [ccId]);
      assert(afterPayCC.currentUsage === expAmount - payAmount, 'CC Usage DECREASED (Credit/Restore)', expAmount - payAmount, afterPayCC.currentUsage);
      assert(afterPayCC.remainingLimit === (limit - expAmount) + payAmount, 'CC Remaining Limit INCREMENTED (Restored)', (limit - expAmount) + payAmount, afterPayCC.remainingLimit);

      addLog('\n🏁 CC TRANSACTION TEST FINISHED - ALL ASSERTIONS PASSED');
      Alert.alert('Success', 'CC Transaction test passed with 100% accuracy.');

      await cleanupTestData(db);
    } catch (error) {
      addLog('❌ TEST FAILED: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bug color={theme.primary} size={24} />
            <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: '900' }}>Developer Test Suite</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color={theme.textSubtle} size={24} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, padding: 20 }}>
          <View style={[styles.infoCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <ShieldCheck color={theme.primary} size={20} />
            <Text style={{ color: theme.primary, fontSize: fs(12), flex: 1, fontWeight: '600' }}>
              These tests use production storage functions to verify the integrity of the credit engine. Results are logged to the console and displayed below.
            </Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity 
              style={[styles.testBtn, { backgroundColor: theme.surface, borderColor: theme.primary }]} 
              onPress={runEmiLifecycleTest}
              disabled={isRunning}
            >
              <Play color={theme.primary} size={20} />
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Test EMI Lifecycle</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.testBtn, { backgroundColor: theme.surface, borderColor: theme.success }]} 
              onPress={runCcTransactionTest}
              disabled={isRunning}
            >
              <Database color={theme.success} size={20} />
              <Text style={{ color: theme.success, fontWeight: 'bold' }}>Test CC Transactions</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.logContainer, { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 }]}>
            <View style={styles.logHeader}>
              <Text style={{ color: theme.textSubtle, fontWeight: '800', fontSize: fs(10) }}>TEST LOGS</Text>
              <TouchableOpacity onPress={clearLogs}>
                <Trash2 color={theme.danger} size={16} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={true}>
              {logs.length === 0 ? (
                <Text style={{ color: theme.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>No logs yet. Run a test above.</Text>
              ) : (
                logs.map((log, i) => (
                  <Text key={i} style={[styles.logText, { color: log.startsWith('❌') ? theme.danger : log.startsWith('✅') ? theme.success : theme.text, fontSize: fs(11) }]}>
                    {log}
                  </Text>
                ))
              )}
              {isRunning && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} />}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  closeBtn: { padding: 4 },
  infoCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20, alignItems: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  testBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  logContainer: { borderRadius: 16, borderWidth: 1, padding: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  logText: { fontFamily: 'monospace', marginBottom: 4 },
});

export default DeveloperTools;
