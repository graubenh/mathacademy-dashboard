/**
 * UI Controller
 * Handles rendering of dashboard components and user interactions
 */

class UIController {
    constructor() {
        this.currentPeriod = 'all';
        this.stats = null;
        this.originalStats = null;
        window.uiController = this; // Make accessible globally
    }

    /**
     * Initialize the UI with calculated statistics
     */
    init(stats) {
        this.originalStats = stats;
        this.stats = stats;
        this.renderDashboard();
        this.attachEventListeners();
    }

    /**
     * Render the complete dashboard
     */
    renderDashboard() {
        this.renderCurrentCourse();
        this.renderMainStats();
        this.renderActivityBreakdown();
        // Check if Chart.js is available before rendering charts
        if (typeof Chart !== 'undefined') {
            this.renderInlineCharts();
        } else {
            console.error('Chart.js not loaded - skipping chart rendering');
        }
    }

    /**
     * Render current course card
     */
    renderCurrentCourse() {
        if (!this.stats.calculator || !this.stats.calculator.data) {
            return;
        }

        const activities = this.stats.calculator.data;
        
        // Find the most recent course (latest activity)
        const sortedActivities = activities
            .filter(activity => activity.course)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (sortedActivities.length === 0) {
            return;
        }
        
        const currentCourse = sortedActivities[0].course;
        
        // Update DOM element
        const courseNameElement = document.getElementById('current-course');
        if (courseNameElement) {
            courseNameElement.textContent = currentCourse;
        }
    }

    /**
     * Render main statistics cards
     */
    renderMainStats() {
        const elements = {
            'total-xp': this.stats.totalXP.toLocaleString(),
            'total-activities': this.stats.totalActivities,
            'avg-xp-day': this.stats.avgXPPerDay,
            'success-rate': this.stats.successMetrics.successRate + '%'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    /**
     * Render inline charts for stat cards
     */
    renderInlineCharts() {
        // Clear label trackers for fresh render
        window.chartLabelTrackers = {};

        if (this.currentPeriod === 'today') {
            // Hide all charts for today view
            ['total-xp-chart', 'total-activities-chart', 'avg-xp-chart', 'success-rate-chart'].forEach(id => {
                const canvas = document.getElementById(id);
                if (canvas) canvas.style.display = 'none';
            });
            return;
        }

        // Show charts for other views
        ['total-xp-chart', 'total-activities-chart', 'avg-xp-chart', 'success-rate-chart'].forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) canvas.style.display = 'block';
        });

        this.renderXPChart();
        this.renderActivitiesChart();
        this.renderAvgXPChart();
        this.renderSuccessRateChart();
    }

    /**
     * Render cumulative XP chart
     */
    renderXPChart() {
        const canvas = document.getElementById('total-xp-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.xpChart) {
            this.xpChart.destroy();
        }

        // Get data based on current period
        const isWeekView = this.currentPeriod === 'week';
        const cumulativeData = window.ChartHelpers ?
            (isWeekView ? ChartHelpers.getWeeklyCumulativeXPData(this.stats) : ChartHelpers.getCumulativeXPData(this.stats))
            : { labels: [], values: [], transitions: {} };

        // Find transition points for vertical lines
        const transitionLines = [];
        const transitionLabels = [];
        if (cumulativeData.transitions) {
            Object.entries(cumulativeData.transitions).forEach(([date, transition]) => {
                const dateIndex = cumulativeData.labels.indexOf(date);
                if (dateIndex !== -1) {
                    transitionLines.push({
                        date: date,
                        index: dateIndex,
                        transition: transition
                    });
                }
            });
        }

        this.xpChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: cumulativeData.labels,
                datasets: [{
                    data: cumulativeData.values,
                    borderColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    backgroundColor: document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.2)' : 'rgba(76, 5, 25, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: isWeekView ? 0.4 : 0,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    clip: false
                }]
            },
            plugins: [{
                id: 'transitionLines',
                afterDraw: (chart) => {
                    if (transitionLines.length === 0) return;

                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const xAxis = chart.scales.x;

                    // Disable clipping so labels can be drawn outside chart area
                    ctx.save();
                    ctx.restore();
                    ctx.save();

                    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.6)' : 'rgba(76, 5, 25, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);

                    transitionLines.forEach(line => {
                        const x = xAxis.getPixelForValue(line.index);

                        // Draw vertical line
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.stroke();

                        // Abbreviate course names for compact display
                        // Must replace longer strings first to avoid partial matches
                        const abbreviate = (courseName) => {
                            return courseName
                                .replace('Mathematical Foundations III', 'MFIII')
                                .replace('Mathematical Foundations II', 'MFII')
                                .replace('Mathematical Foundations I', 'MFI')
                                .replace('Mathematics for Machine Learning', 'M4ML');
                        };
                        const labelText = `${abbreviate(line.transition.from)} → ${abbreviate(line.transition.to)}`;

                        // Set label style
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 1)' : 'rgba(76, 5, 25, 0.7)';
                        ctx.font = '10px system-ui';
                        ctx.textBaseline = 'top';

                        // Measure text width to determine if it fits on the right
                        const textMetrics = ctx.measureText(labelText);
                        const textWidth = textMetrics.width;
                        const chartWidth = xAxis.right;
                        const spaceOnRight = chartWidth - x - 5;

                        // Position label on left or right depending on available space
                        if (spaceOnRight < textWidth) {
                            // Not enough space on right, put it on the left
                            ctx.textAlign = 'right';
                            ctx.fillText(labelText, x - 5, yAxis.top);
                        } else {
                            // Enough space on right
                            ctx.textAlign = 'left';
                            ctx.fillText(labelText, x + 5, yAxis.top);
                        }
                    });

                    ctx.restore();
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: { display: false },
                        type: 'category',
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(value, index, values) {
                                const currentPeriod = window.uiController ? window.uiController.currentPeriod : 'all';
                                
                                if (currentPeriod === 'today') {
                                    return ''; // No labels for today view
                                }
                                
                                const dateStr = this.getLabelForValue(value);
                                const date = new Date(dateStr);
                                
                                if (currentPeriod === 'week') {
                                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    // Show first occurrence of each day
                                    if (index === 0) return dayLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevDayLabel = prevDate.toLocaleDateString('en-US', { weekday: 'short' });
                                    return dayLabel !== prevDayLabel ? dayLabel : '';
                                } else {
                                    const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
                                    // Filter out August (month index 7) and earlier months
                                    if (date.getMonth() < 8) { // Don't show August or earlier months
                                        return '';
                                    }
                                    // Show first occurrence of each month
                                    if (index === 0) return monthLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevMonthLabel = prevDate.toLocaleDateString('en-US', { month: 'short' });
                                    return monthLabel !== prevMonthLabel ? monthLabel : '';
                                }
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'left',
                        grid: { display: false },
                        min: 0,
                        max: function(context) {
                            const max = Math.max(...context.chart.data.datasets[0].data);
                            if (isWeekView) {
                                // For week view, use more granular rounding
                                if (max <= 100) return Math.ceil(max * 1.2 / 10) * 10;
                                if (max <= 500) return Math.ceil(max * 1.2 / 50) * 50;
                                return Math.ceil(max * 1.2 / 100) * 100;
                            }
                            return Math.ceil(max * 1.1 / 1000) * 1000; // Round up to nearest 1000
                        },
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxTicksLimit: 2,
                            callback: function(value) {
                                if (value >= 1000) return (value/1000).toFixed(0) + 'k';
                                return value.toFixed(0);
                            }
                        }
                    }
                },
                elements: {
                    point: { radius: 0 }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    /**
     * Render cumulative activities chart
     */
    renderActivitiesChart() {
        const canvas = document.getElementById('total-activities-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.activitiesChart) {
            this.activitiesChart.destroy();
        }

        const isWeekView = this.currentPeriod === 'week';
        const cumulativeData = window.ChartHelpers ?
            (isWeekView ? ChartHelpers.getWeeklyCumulativeActivitiesData(this.stats) : ChartHelpers.getCumulativeActivitiesData(this.stats))
            : { labels: [], values: [], transitions: {} };
        
        // Find transition points for vertical lines
        const transitionLines = [];
        if (cumulativeData.transitions) {
            Object.entries(cumulativeData.transitions).forEach(([date, transition]) => {
                const dateIndex = cumulativeData.labels.indexOf(date);
                if (dateIndex !== -1) {
                    transitionLines.push({
                        date: date,
                        index: dateIndex,
                        transition: transition
                    });
                }
            });
        }
        

        this.activitiesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: cumulativeData.labels,
                datasets: [{
                    data: cumulativeData.values,
                    borderColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    backgroundColor: document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.2)' : 'rgba(76, 5, 25, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: isWeekView ? 0.4 : 0.4,
                    pointRadius: 0,
                    pointBackgroundColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    clip: false
                }]
            },
            plugins: [{
                id: 'transitionLines',
                afterDraw: (chart) => {
                    if (transitionLines.length === 0) return;

                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const xAxis = chart.scales.x;

                    // Disable clipping so labels can be drawn outside chart area
                    ctx.save();
                    ctx.restore();
                    ctx.save();

                    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.6)' : 'rgba(76, 5, 25, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);

                    transitionLines.forEach(line => {
                        const x = xAxis.getPixelForValue(line.index);

                        // Draw vertical line
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.stroke();

                        // Abbreviate course names for compact display
                        // Must replace longer strings first to avoid partial matches
                        const abbreviate = (courseName) => {
                            return courseName
                                .replace('Mathematical Foundations III', 'MFIII')
                                .replace('Mathematical Foundations II', 'MFII')
                                .replace('Mathematical Foundations I', 'MFI')
                                .replace('Mathematics for Machine Learning', 'M4ML');
                        };
                        const labelText = `${abbreviate(line.transition.from)} → ${abbreviate(line.transition.to)}`;

                        // Set label style
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 1)' : 'rgba(76, 5, 25, 0.7)';
                        ctx.font = '10px system-ui';
                        ctx.textBaseline = 'top';

                        // Measure text width to determine if it fits on the right
                        const textMetrics = ctx.measureText(labelText);
                        const textWidth = textMetrics.width;
                        const chartWidth = xAxis.right;
                        const spaceOnRight = chartWidth - x - 5;

                        // Position label on left or right depending on available space
                        if (spaceOnRight < textWidth) {
                            // Not enough space on right, put it on the left
                            ctx.textAlign = 'right';
                            ctx.fillText(labelText, x - 5, yAxis.top);
                        } else {
                            // Enough space on right
                            ctx.textAlign = 'left';
                            ctx.fillText(labelText, x + 5, yAxis.top);
                        }
                    });

                    ctx.restore();
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: { display: false },
                        type: 'category',
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(value, index, values) {
                                const currentPeriod = window.uiController ? window.uiController.currentPeriod : 'all';
                                
                                if (currentPeriod === 'today') {
                                    return ''; // No labels for today view
                                }
                                
                                const dateStr = this.getLabelForValue(value);
                                const date = new Date(dateStr);
                                
                                if (currentPeriod === 'week') {
                                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    // Show first occurrence of each day
                                    if (index === 0) return dayLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevDayLabel = prevDate.toLocaleDateString('en-US', { weekday: 'short' });
                                    return dayLabel !== prevDayLabel ? dayLabel : '';
                                } else {
                                    const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
                                    // Filter out August (month index 7) and earlier months
                                    if (date.getMonth() < 8) { // Don't show August or earlier months
                                        return '';
                                    }
                                    // Show first occurrence of each month
                                    if (index === 0) return monthLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevMonthLabel = prevDate.toLocaleDateString('en-US', { month: 'short' });
                                    return monthLabel !== prevMonthLabel ? monthLabel : '';
                                }
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'left',
                        grid: { display: false },
                        min: 0,
                        max: function(context) {
                            const max = Math.max(...context.chart.data.datasets[0].data);
                            if (isWeekView) {
                                // For week view, use more granular rounding
                                if (max <= 20) return Math.ceil(max * 1.2 / 2) * 2;
                                if (max <= 50) return Math.ceil(max * 1.2 / 5) * 5;
                                return Math.ceil(max * 1.2 / 10) * 10;
                            }
                            return Math.ceil(max * 1.1 / 100) * 100; // Round up to nearest 100
                        },
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxTicksLimit: 2
                        }
                    }
                }
            }
        });
    }

    /**
     * Render average XP per day chart
     */
    renderAvgXPChart() {
        const canvas = document.getElementById('avg-xp-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.avgXPChart) {
            this.avgXPChart.destroy();
        }

        const isWeekView = this.currentPeriod === 'week';
        const avgData = window.ChartHelpers ?
            (isWeekView ? ChartHelpers.getDailyXPData(this.stats) : ChartHelpers.getAvgXPOverTimeData(this.stats))
            : { labels: [], values: [], transitions: {} };
        
        // Find transition points for vertical lines
        const transitionLines = [];
        if (avgData.transitions) {
            Object.entries(avgData.transitions).forEach(([date, transition]) => {
                const dateIndex = avgData.labels.indexOf(date);
                if (dateIndex !== -1) {
                    transitionLines.push({
                        date: date,
                        index: dateIndex,
                        transition: transition
                    });
                }
            });
        }
        
        this.avgXPChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: avgData.labels,
                datasets: [{
                    data: avgData.values,
                    borderColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    backgroundColor: document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.2)' : 'rgba(76, 5, 25, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: isWeekView ? 0.4 : 0.4,
                    pointRadius: 0,
                    pointBackgroundColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519'
                }]
            },
            plugins: [{
                id: 'transitionLines',
                afterDraw: (chart) => {
                    if (transitionLines.length === 0) return;

                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const xAxis = chart.scales.x;

                    // Disable clipping so labels can be drawn outside chart area
                    ctx.save();
                    ctx.restore();
                    ctx.save();

                    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.6)' : 'rgba(76, 5, 25, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);

                    transitionLines.forEach(line => {
                        const x = xAxis.getPixelForValue(line.index);

                        // Draw vertical line
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.stroke();

                        // Abbreviate course names for compact display
                        // Must replace longer strings first to avoid partial matches
                        const abbreviate = (courseName) => {
                            return courseName
                                .replace('Mathematical Foundations III', 'MFIII')
                                .replace('Mathematical Foundations II', 'MFII')
                                .replace('Mathematical Foundations I', 'MFI')
                                .replace('Mathematics for Machine Learning', 'M4ML');
                        };
                        const labelText = `${abbreviate(line.transition.from)} → ${abbreviate(line.transition.to)}`;

                        // Set label style
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 1)' : 'rgba(76, 5, 25, 0.7)';
                        ctx.font = '10px system-ui';
                        ctx.textBaseline = 'top';

                        // Measure text width to determine if it fits on the right
                        const textMetrics = ctx.measureText(labelText);
                        const textWidth = textMetrics.width;
                        const chartWidth = xAxis.right;
                        const spaceOnRight = chartWidth - x - 5;

                        // Position label on left or right depending on available space
                        if (spaceOnRight < textWidth) {
                            // Not enough space on right, put it on the left
                            ctx.textAlign = 'right';
                            ctx.fillText(labelText, x - 5, yAxis.top);
                        } else {
                            // Enough space on right
                            ctx.textAlign = 'left';
                            ctx.fillText(labelText, x + 5, yAxis.top);
                        }
                    });

                    ctx.restore();
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: { display: false },
                        type: 'category',
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(value, index, values) {
                                const currentPeriod = window.uiController ? window.uiController.currentPeriod : 'all';
                                
                                if (currentPeriod === 'today') {
                                    return ''; // No labels for today view
                                }
                                
                                const dateStr = this.getLabelForValue(value);
                                const date = new Date(dateStr);
                                
                                if (currentPeriod === 'week') {
                                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    // Show first occurrence of each day
                                    if (index === 0) return dayLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevDayLabel = prevDate.toLocaleDateString('en-US', { weekday: 'short' });
                                    return dayLabel !== prevDayLabel ? dayLabel : '';
                                } else {
                                    const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
                                    // Filter out August (month index 7) and earlier months
                                    if (date.getMonth() < 8) { // Don't show August or earlier months
                                        return '';
                                    }
                                    // Show first occurrence of each month
                                    if (index === 0) return monthLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevMonthLabel = prevDate.toLocaleDateString('en-US', { month: 'short' });
                                    return monthLabel !== prevMonthLabel ? monthLabel : '';
                                }
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'left',
                        grid: { display: false },
                        min: function(context) {
                            if (isWeekView) return 0;
                            const min = Math.min(...context.chart.data.datasets[0].data);
                            return Math.floor(min * 0.9 / 10) * 10; // Round down to nearest 10
                        },
                        max: function(context) {
                            const max = Math.max(...context.chart.data.datasets[0].data);
                            if (isWeekView) {
                                // For week view, use more granular rounding
                                if (max <= 100) return Math.ceil(max * 1.2 / 10) * 10;
                                if (max <= 500) return Math.ceil(max * 1.2 / 50) * 50;
                                return Math.ceil(max * 1.2 / 100) * 100;
                            }
                            return Math.ceil(max * 1.1 / 10) * 10; // Round up to nearest 10
                        },
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxTicksLimit: 2
                        }
                    }
                }
            }
        });
    }

    /**
     * Render success rate chart
     */
    renderSuccessRateChart() {
        const canvas = document.getElementById('success-rate-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.successChart) {
            this.successChart.destroy();
        }

        const isWeekView = this.currentPeriod === 'week';
        const successData = window.ChartHelpers ?
            (isWeekView ? ChartHelpers.getDailyAttainmentData(this.stats) : ChartHelpers.getSuccessRateOverTimeData(this.stats))
            : { labels: [], values: [], transitions: {} };
        
        // Find transition points for vertical lines
        const transitionLines = [];
        if (successData.transitions) {
            Object.entries(successData.transitions).forEach(([date, transition]) => {
                const dateIndex = successData.labels.indexOf(date);
                if (dateIndex !== -1) {
                    transitionLines.push({
                        date: date,
                        index: dateIndex,
                        transition: transition
                    });
                }
            });
        }
        
        this.successChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: successData.labels,
                datasets: [{
                    data: successData.values,
                    borderColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519',
                    backgroundColor: document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.2)' : 'rgba(76, 5, 25, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: isWeekView ? 0.4 : 0.4,
                    pointRadius: 0,
                    pointBackgroundColor: document.body.classList.contains('dark-mode') ? '#ff6b85' : '#4c0519'
                }]
            },
            plugins: [{
                id: 'transitionLines',
                afterDraw: (chart) => {
                    if (transitionLines.length === 0) return;

                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const xAxis = chart.scales.x;

                    // Disable clipping so labels can be drawn outside chart area
                    ctx.save();
                    ctx.restore();
                    ctx.save();

                    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 0.6)' : 'rgba(76, 5, 25, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);

                    transitionLines.forEach(line => {
                        const x = xAxis.getPixelForValue(line.index);

                        // Draw vertical line
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.stroke();

                        // Abbreviate course names for compact display
                        // Must replace longer strings first to avoid partial matches
                        const abbreviate = (courseName) => {
                            return courseName
                                .replace('Mathematical Foundations III', 'MFIII')
                                .replace('Mathematical Foundations II', 'MFII')
                                .replace('Mathematical Foundations I', 'MFI')
                                .replace('Mathematics for Machine Learning', 'M4ML');
                        };
                        const labelText = `${abbreviate(line.transition.from)} → ${abbreviate(line.transition.to)}`;

                        // Set label style
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 107, 133, 1)' : 'rgba(76, 5, 25, 0.7)';
                        ctx.font = '10px system-ui';
                        ctx.textBaseline = 'top';

                        // Measure text width to determine if it fits on the right
                        const textMetrics = ctx.measureText(labelText);
                        const textWidth = textMetrics.width;
                        const chartWidth = xAxis.right;
                        const spaceOnRight = chartWidth - x - 5;

                        // Position label on left or right depending on available space
                        if (spaceOnRight < textWidth) {
                            // Not enough space on right, put it on the left
                            ctx.textAlign = 'right';
                            ctx.fillText(labelText, x - 5, yAxis.top);
                        } else {
                            // Enough space on right
                            ctx.textAlign = 'left';
                            ctx.fillText(labelText, x + 5, yAxis.top);
                        }
                    });

                    ctx.restore();
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: { display: false },
                        type: 'category',
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(value, index, values) {
                                const currentPeriod = window.uiController ? window.uiController.currentPeriod : 'all';
                                
                                if (currentPeriod === 'today') {
                                    return ''; // No labels for today view
                                }
                                
                                const dateStr = this.getLabelForValue(value);
                                const date = new Date(dateStr);
                                
                                if (currentPeriod === 'week') {
                                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    // Show first occurrence of each day
                                    if (index === 0) return dayLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevDayLabel = prevDate.toLocaleDateString('en-US', { weekday: 'short' });
                                    return dayLabel !== prevDayLabel ? dayLabel : '';
                                } else {
                                    const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
                                    // Filter out August (month index 7) and earlier months
                                    if (date.getMonth() < 8) { // Don't show August or earlier months
                                        return '';
                                    }
                                    // Show first occurrence of each month
                                    if (index === 0) return monthLabel;
                                    const prevDateStr = this.getLabelForValue(value - 1);
                                    const prevDate = new Date(prevDateStr);
                                    const prevMonthLabel = prevDate.toLocaleDateString('en-US', { month: 'short' });
                                    return monthLabel !== prevMonthLabel ? monthLabel : '';
                                }
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'left',
                        grid: { display: false },
                        min: function(context) {
                            if (isWeekView) {
                                const min = Math.min(...context.chart.data.datasets[0].data);
                                return Math.max(0, Math.floor(min * 0.9 / 10) * 10);
                            }
                            const min = Math.min(...context.chart.data.datasets[0].data);
                            return Math.floor(min * 0.9 / 10) * 10; // Round down to nearest 10
                        },
                        max: function(context) {
                            const max = Math.max(...context.chart.data.datasets[0].data);
                            if (isWeekView) {
                                // Allow values above 100%
                                return Math.ceil(max * 1.1 / 10) * 10;
                            }
                            return Math.ceil(max * 1.1 / 10) * 10; // Round up to nearest 10
                        },
                        ticks: {
                            color: document.body.classList.contains('dark-mode') ? '#cccccc' : '#7a7a7a',
                            font: { size: 10, weight: '400' },
                            maxTicksLimit: 2,
                            callback: function(value) {
                                return value.toFixed(0) + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render activity breakdown
     */
    renderActivityBreakdown() {
        const counts = this.stats.activityCounts;
        const elements = {
            'diagnostics-count': counts.diagnostics,
            'lessons-count': counts.lessons,
            'reviews-count': counts.reviews,
            'multisteps-count': counts.multisteps,
            'quizzes-count': counts.quizzes
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Time period selector
        const periodSelect = document.getElementById('time-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => this.switchPeriod(e));
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const btn = document.querySelector('.theme-toggle');
        if (btn) {
            btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
        }
        
        // Save theme preference
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        
        // Re-render charts with new colors
        if (typeof Chart !== 'undefined') {
            this.renderInlineCharts();
        }
    }

    /**
     * Load saved theme
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            const btn = document.querySelector('.theme-toggle');
            if (btn) {
                btn.textContent = '☀️';
            }
        }
    }

    /**
     * Switch time period
     */
    switchPeriod(event) {
        // Get period and update stats
        const period = event.target.value;
        this.currentPeriod = period;
        
        // Calculate filtered stats
        if (this.originalStats && this.originalStats.calculator) {
            const filteredCalculator = this.originalStats.calculator.filterByPeriod(period);
            this.stats = filteredCalculator.calculateStats();
            this.stats.calculator = filteredCalculator;
        }
        
        // Re-render dashboard
        this.renderDashboard();
    }

    /**
     * Show loading state
     */
    showLoading() {
        const container = document.querySelector('.container');
        if (container) {
            container.classList.add('loading');
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const container = document.querySelector('.container');
        if (container) {
            container.classList.remove('loading');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <h3>Error Loading Data</h3>
            <p>${message}</p>
            <p>Please make sure the mathacademy_source.html file is in the data/ directory.</p>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
        }
    }

    /**
     * Add animation to stats cards
     */
    animateStats() {
        const cards = document.querySelectorAll('.stat-card, .activity-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'all 0.5s ease';
                
                requestAnimationFrame(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
            }, index * 100);
        });
    }

    /**
     * Update stats with new data
     */
    updateStats(newStats) {
        this.originalStats = newStats;
        
        // Apply current period filter
        if (newStats.calculator) {
            const filteredCalculator = newStats.calculator.filterByPeriod(this.currentPeriod);
            this.stats = filteredCalculator.calculateStats();
            this.stats.calculator = filteredCalculator;
        } else {
            this.stats = newStats;
        }
        
        this.renderDashboard();
        this.animateStats();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
} else {
    window.UIController = UIController;
}