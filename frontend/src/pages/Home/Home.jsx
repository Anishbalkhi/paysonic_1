import React, { useState, useEffect } from 'react';
import HomeService from '../../services/home/HomeService';
import MetricCard from './components/MetricCard';
import RevenueChart from './components/RevenueChart';
import TransactionTable from './components/TransactionTable';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Loader from '../../components/Loader/Loader';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import './Home.scss';

export const Home = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await HomeService.getDashboardData();
        setData(res);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExecutePayout = async () => {
    setIsProcessingAction(true);
    try {
      await HomeService.executeQuickAction('instant-payout', { amount: 50000 });
      setPayoutModalOpen(false);
      alert('Instant payout request queued successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading) {
    return <Loader message="Fetching Paysonic dashboard analytics..." />;
  }

  if (!data) {
    return (
      <div className="container py-8">
        <p className="text-danger">Failed to load dashboard metrics.</p>
      </div>
    );
  }

  const { summary, chartData, recentTransactions, systemStatus } = data;

  return (
    <div className="home-page">
      <div className="container">
        {/* Header */}
        <div className="home-page__header">
          <div className="header-top">
            <div>
              <h1>Financial Overview</h1>
              <p>Real-time analytics for Paysonic global payment infrastructure</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setPayoutModalOpen(true)}
              >
                Instant Settlement
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => alert('Exporting monthly ledger CSV...')}
              >
                Export Ledger
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="home-page__metrics">
          <MetricCard
            title="Total Processed Volume"
            value={formatCurrency(summary.totalRevenue)}
            change={summary.revenueGrowth}
            isPositive={summary.revenueGrowth > 0}
          />
          <MetricCard
            title="Total Transactions"
            value={formatNumber(summary.transactionVolume)}
            change={summary.volumeGrowth}
            isPositive={summary.volumeGrowth > 0}
          />
          <MetricCard
            title="Active Merchants & Users"
            value={formatNumber(summary.activeUsers)}
            change={summary.usersGrowth}
            isPositive={summary.usersGrowth > 0}
          />
          <MetricCard
            title="Success Authorization Rate"
            value={`${summary.successRate}%`}
            change={summary.successRateChange}
            isPositive={summary.successRateChange > 0}
          />
        </div>

        {/* Chart and System Status Grid */}
        <div className="home-page__grid">
          <RevenueChart data={chartData} />

          <div className="card system-card">
            <div>
              <h3 className="system-card__title">Engine Telemetry</h3>
              <div className="system-card__list">
                <div className="system-card__item">
                  <span className="label">Core Gateway Status</span>
                  <span className="badge badge--success">{systemStatus.gatewayStatus}</span>
                </div>
                <div className="system-card__item">
                  <span className="label">Average API Latency</span>
                  <span className="val">{systemStatus.avgLatencyMs} ms</span>
                </div>
                <div className="system-card__item">
                  <span className="label">System Uptime SLA</span>
                  <span className="val">{systemStatus.uptime}</span>
                </div>
                <div className="system-card__item">
                  <span className="label">API Calls Today</span>
                  <span className="val">{formatNumber(systemStatus.apiCallsToday)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <span className="text-xs text-muted">Cluster: us-east-aurora-primary</span>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <TransactionTable
          transactions={recentTransactions}
          onViewDetail={(tx) => setSelectedTx(tx)}
        />

        {/* Transaction Detail Modal */}
        <Modal
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title={`Transaction ${selectedTx?.id}`}
          showFooter={false}
        >
          {selectedTx && (
            <div className="flex-col gap-3">
              <div className="flex-between">
                <span className="text-muted">Customer</span>
                <span className="font-semibold">{selectedTx.customer}</span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Account Email</span>
                <span>{selectedTx.email}</span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Amount</span>
                <span className="font-bold text-primary">
                  {formatCurrency(selectedTx.amount, selectedTx.currency)}
                </span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Payment Channel</span>
                <span className="badge badge--neutral">{selectedTx.method}</span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Timestamp</span>
                <span>{formatDate(selectedTx.date, true)}</span>
              </div>
              <div className="flex-between">
                <span className="text-muted">Status</span>
                <span className={`badge badge--${selectedTx.status === 'completed' ? 'success' : 'warning'}`}>
                  {selectedTx.status}
                </span>
              </div>
            </div>
          )}
        </Modal>

        {/* Instant Payout Modal */}
        <Modal
          isOpen={payoutModalOpen}
          onClose={() => setPayoutModalOpen(false)}
          title="Trigger Instant Settlement"
          confirmText="Confirm Transfer"
          confirmVariant="primary"
          isLoading={isProcessingAction}
          onConfirm={handleExecutePayout}
        >
          <p className="mb-4">
            Authorize an immediate liquidity transfer from Paysonic Escrow Vault to your primary connected corporate bank account.
          </p>
          <div className="card bg-subtle p-3 mb-3">
            <div className="flex-between">
              <span className="text-sm text-secondary">Transfer Amount:</span>
              <span className="font-bold text-base">$50,000.00 USD</span>
            </div>
            <div className="flex-between mt-2">
              <span className="text-sm text-secondary">Settlement Protocol:</span>
              <span className="text-sm font-semibold">FedNow / Instant RTP</span>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Home;
