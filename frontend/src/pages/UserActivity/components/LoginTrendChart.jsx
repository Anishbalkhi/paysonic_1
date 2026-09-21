import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import UserActivityService from '../../../services/userActivity/UserActivityService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const LoginTrendChart = () => {
  const [days, setDays] = useState(7);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    UserActivityService.getLoginTrend(days).then((data) => {
      if (isMounted) {
        setChartData(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [days]);

  const data = {
    labels: chartData?.labels || [],
    datasets: [
      {
        label: 'Successful Authentications',
        data: chartData?.datasets?.successful || [],
        borderColor: '#3762F2',
        backgroundColor: 'rgba(55, 98, 242, 0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#3762F2',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Failed Attempts',
        data: chartData?.datasets?.failed || [],
        borderColor: '#B42318',
        backgroundColor: 'rgba(180, 35, 24, 0.04)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#B42318',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: {
            family: 'Plus Jakarta Sans',
            size: 12,
            weight: '500',
          },
          color: '#475467',
        },
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { family: 'Manrope', size: 13, weight: '700' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#667085',
          font: { family: 'Plus Jakarta Sans', size: 11 },
        },
      },
      y: {
        grid: {
          color: '#F2F4F7',
        },
        ticks: {
          color: '#667085',
          font: { family: 'Plus Jakarta Sans', size: 11 },
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3>Authentication Velocity</h3>
          <p>Successful vs failed logins monitored across cluster gateways</p>
        </div>
        <div className="range-toggles">
          <button
            type="button"
            className={`range-btn ${days === 7 ? 'active' : ''}`}
            onClick={() => setDays(7)}
          >
            7 Days
          </button>
          <button
            type="button"
            className={`range-btn ${days === 14 ? 'active' : ''}`}
            onClick={() => setDays(14)}
          >
            14 Days
          </button>
          <button
            type="button"
            className={`range-btn ${days === 30 ? 'active' : ''}`}
            onClick={() => setDays(30)}
          >
            30 Days
          </button>
        </div>
      </div>
      <div className="chart-card__canvas-wrap">
        {loading ? (
          <div className="chart-loading">Loading trend telemetry...</div>
        ) : (
          <Line data={data} options={options} />
        )}
      </div>
    </div>
  );
};

export default LoginTrendChart;
