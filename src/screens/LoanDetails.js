import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAccounts, payLoanInstallment, getCategories, getDb } from '../services/storage';

// Loan Components
import LoanSummaryCard from '../components/loans/LoanSummaryCard';
import LoanInstallmentItem from '../components/loans/LoanInstallmentItem';
import LoanDetailsModal from '../components/loans/LoanDetailsModal';
import LoanSettlementModal from '../components/loans/LoanSettlementModal';
import LoanTransactionsModal from '../components/loans/LoanTransactionsModal';
import LoanForecloseModal from '../components/loans/LoanForecloseModal';

// Utils
import { calculateAmortizationSchedule, calculateEmiTotals } from '../utils/loanUtils';


export default function LoanDetails() {
    const { theme, fs } = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const { activeUser } = useAuth();
    const { accountId } = route.params || {};
    const insets = useSafeAreaInsets();
    const today = new Date();

    const [account, setAccount] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showForecloseModal, setShowForecloseModal] = useState(false);
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedEmi, setSelectedEmi] = useState(null);
    const [settleAccountId, setSettleAccountId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const flatListRef = React.useRef(null);
    const hasScrolledInitial = React.useRef(false);

    const loadAccount = async () => {
        if (!accountId) return;
        const accs = await getAccounts(activeUser.id);
        const found = accs.find(a => a.id === accountId);
        setAccount(found);
        setAccounts(accs);

    };

    useFocusEffect(React.useCallback(() => { 
        hasScrolledInitial.current = false;
        loadAccount(); 
    }, [accountId]));

    const schedule = useMemo(() => calculateAmortizationSchedule(account), [account]);
    const totals = useMemo(() => calculateEmiTotals(schedule), [schedule]);

    React.useEffect(() => {
        if (schedule.length > 0 && !hasScrolledInitial.current) {
            const now = new Date();
            const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const idx = schedule.findIndex(i => i.monthKey === currentMonthKey);
            
            if (idx !== -1) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index: idx,
                        animated: true,
                        viewPosition: 0
                    });
                    hasScrolledInitial.current = true;
                }, 500);
            }
        }
    }, [schedule]);

    const handleSettle = async () => {
        if (!settleAccountId) {
            alert('Please select an account');
            return;
        }
        try {
            const db = await getDb();
            const amount = selectedEmi?.totalOutflow || account.emiAmount;
            await payLoanInstallment(activeUser.id, account.id, settleAccountId, amount, selectedEmi?.monthKey);
            setShowSettleModal(false);
            loadAccount();
        } catch (e) {
            alert(e.message);
        }
    };

    if (!account) return <View style={[styles.container, { backgroundColor: theme.background }]} />;

    const onSettleClick = (item) => {
        setSelectedEmi(item);
        const bank = accounts.find(a => a.type === 'BANK');
        setSettleAccountId(bank?.id || null);
        setShowSettleModal(true);
    };

    const onDetailsClick = (item) => {
        setSelectedMonth(item);
        setShowModal(true);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <CustomHeader 
                title="Loan Schedule"
                leftComponent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft color={theme.text} size={28} />
                    </TouchableOpacity>
                }
                theme={theme}
                fs={fs}
            />

            <LoanSummaryCard 
                account={account} 
                totals={totals} 
                schedule={schedule}
                scheduleLength={schedule.length} 
                theme={theme} 
                fs={fs} 
                onViewTransactions={() => setShowTxModal(true)}
                onForeclose={() => setShowForecloseModal(true)}
            />

            <FlatList
                ref={flatListRef}
                data={schedule}
                keyExtractor={item => item.month.toString()}
                renderItem={({ item }) => {
                    const itemMonth = item.monthDate.getMonth();
                    const itemYear = item.monthDate.getFullYear();
                    const currMonth = today.getMonth();
                    const currYear = today.getFullYear();
                    
                    const isPast = (itemYear < currYear) || (itemYear === currYear && itemMonth < currMonth);
                    const isCurrent = (itemYear === currYear && itemMonth === currMonth);

                    return (
                        <LoanInstallmentItem 
                            item={item}
                            isPaid={item.isCompleted}
                            isPast={isPast}
                            isCurrent={isCurrent}
                            type={account.type}
                            onSettle={onSettleClick}
                            onDetails={onDetailsClick}
                            theme={theme}
                            fs={fs}
                        />
                    );
                }}
                contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
                getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })} 
            />

            <LoanDetailsModal 
                visible={showModal}
                selectedMonth={selectedMonth}
                onClose={() => setShowModal(false)}
                insets={insets}
            />

            <LoanSettlementModal 
                visible={showSettleModal}
                selectedEmi={selectedEmi}
                accounts={accounts}
                settleAccountId={settleAccountId}
                onSelectAccount={setSettleAccountId}
                onConfirm={handleSettle}
                onClose={() => setShowSettleModal(false)}
            />

            <LoanTransactionsModal 
                visible={showTxModal}
                accountId={account.id}
                onClose={() => setShowTxModal(false)}
                insets={insets}
            />

            <LoanForecloseModal 
                visible={showForecloseModal}
                item={account}
                accounts={accounts}
                activeUser={activeUser}
                onClose={() => setShowForecloseModal(false)}
                onSuccess={loadAccount}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backBtn: { padding: 4, marginLeft: -4 },
});
