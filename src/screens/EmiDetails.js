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
import { getAccounts, payEmi, getCategories } from '../services/storage';

// Components
import EmiSummaryCard from '../components/emis/EmiSummaryCard';
import EmiInstallmentItem from '../components/emis/EmiInstallmentItem';
import EmiDetailsModal from '../components/emis/EmiDetailsModal';
import EmiSettlementModal from '../components/emis/EmiSettlementModal';
import AddFineModal from '../components/accounts/AddFineModal';
import EmiTransactionsModal from '../components/emis/EmiTransactionsModal';

// Utils
import { calculateAmortizationSchedule, calculateEmiTotals } from '../utils/emiUtils';

export default function EmiDetails() {
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
    const [showFineModal, setShowFineModal] = useState(false);
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedEmi, setSelectedEmi] = useState(null);
    const [settleAccountId, setSettleAccountId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [finedMonths, setFinedMonths] = useState(new Set());
    const flatListRef = React.useRef(null);
    const hasScrolledInitial = React.useRef(false);

    const loadAccount = async () => {
        if (!accountId) return;
        const accs = await getAccounts(activeUser.id);
        const found = accs.find(a => a.id === accountId);
        setAccount(found);
        setAccounts(accs);

        // Fetch fines to track "frozen" buttons
        try {
            const { getTransactionsByLinkedItem } = require('../services/storage');
            const txs = await getTransactionsByLinkedItem(accountId);
            const fines = txs
                .filter(t => t.type === 'EMI_FINE' && t.monthKey)
                .map(t => t.monthKey);
            setFinedMonths(new Set(fines));
        } catch (e) {
            console.error('Error loading fines for EMI', e);
        }

    };

    useFocusEffect(React.useCallback(() => { 
        hasScrolledInitial.current = false;
        loadAccount(); 
    }, [accountId]));

    const schedule = useMemo(() => calculateAmortizationSchedule(account), [account]);
    const totals = useMemo(() => calculateEmiTotals(schedule), [schedule]);

    React.useEffect(() => {
        if (schedule.length > 0 && !hasScrolledInitial.current) {
            const today = new Date();
            const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
            
            const idx = schedule.findIndex(i => i.monthKey === prevMonthKey);
            // If previous month not found (e.g. loan just started), find current month
            const finalIdx = idx !== -1 ? idx : schedule.findIndex(i => i.monthKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

            if (finalIdx !== -1) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index: finalIdx,
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
            const amount = selectedEmi?.totalOutflow || account.emiAmount;
            await payEmi(activeUser.id, account.id, settleAccountId, amount, selectedEmi?.monthKey);
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

    const onFineClick = (item) => {
        setSelectedEmi(item);
        setShowFineModal(true);
    };

    const onDetailsClick = (item) => {
        setSelectedMonth(item);
        setShowModal(true);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <CustomHeader 
                title="Amortization Schedule"
                leftComponent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft color={theme.text} size={28} />
                    </TouchableOpacity>
                }
                theme={theme}
                fs={fs}
            />

            <EmiSummaryCard 
                account={account} 
                totals={totals} 
                schedule={schedule}
                scheduleLength={schedule.length} 
                theme={theme} 
                fs={fs} 
                onViewTransactions={() => setShowTxModal(true)}
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
                        <EmiInstallmentItem 
                            item={item}
                            isPaid={item.isCompleted}
                            isPast={isPast}
                            isCurrent={isCurrent}
                            finePaid={finedMonths.has(item.monthKey)}
                            onSettle={onSettleClick}
                            onFine={onFineClick}
                            onDetails={onDetailsClick}
                            theme={theme}
                            fs={fs}
                        />
                    );
                }}
                contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
                getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })} 
            />

            <EmiDetailsModal 
                visible={showModal}
                selectedMonth={selectedMonth}
                onClose={() => setShowModal(false)}
                insets={insets}
            />

            <EmiSettlementModal 
                visible={showSettleModal}
                selectedEmi={selectedEmi}
                accounts={accounts}
                settleAccountId={settleAccountId}
                onSelectAccount={setSettleAccountId}
                onConfirm={handleSettle}
                onClose={() => setShowSettleModal(false)}
            />

            <AddFineModal 
                visible={showFineModal}
                item={account}
                monthKey={selectedEmi?.monthKey}
                accounts={accounts}
                onClose={() => setShowFineModal(false)}
                onSuccess={() => loadAccount()}
            />

            <EmiTransactionsModal 
                visible={showTxModal}
                accountId={account.id}
                onClose={() => setShowTxModal(false)}
                insets={insets}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backBtn: { padding: 4, marginLeft: -4 },
    infoBtn: { padding: 8 },
});
