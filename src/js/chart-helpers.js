/**
 * Chart Helper Functions
 * Provides data calculation methods for inline charts with proper daily aggregation
 */

class ChartHelpers {
    /**
     * Group activities by day
     */
    static groupActivitiesByDay(activities) {
        const dailyGroups = {};
        
        activities.forEach(activity => {
            // Use timestamp to get actual date, convert to YYYY-MM-DD format
            const date = new Date(activity.timestamp);
            const dateKey = date.toISOString().split('T')[0]; // Gets YYYY-MM-DD
            
            if (!dailyGroups[dateKey]) {
                dailyGroups[dateKey] = {
                    date: dateKey,
                    xp: 0,
                    count: 0,
                    totalPossible: 0,
                    totalEarned: 0,
                    courses: new Set()
                };
            }
            
            dailyGroups[dateKey].xp += activity.earned || 0;
            dailyGroups[dateKey].count += 1;
            
            // Track course information
            if (activity.course) {
                dailyGroups[dateKey].courses.add(activity.course);
            }
            
            // Use the same logic as StatisticsCalculator for consistency
            const type = activity.type.toLowerCase();
            const taskName = activity.taskName || '';
            const isQuiz = taskName.toLowerCase().includes('quiz');
            const isDiagnostic = !isQuiz && (type === 'diagnostic' || type === 'assessment' || type === 'supplemental diagnostic');
            
            let earnedXP, possibleXP;
            
            if (isDiagnostic) {
                // For diagnostics: earned is both earned and possible (100% attainment)
                earnedXP = activity.earned || 0;
                possibleXP = activity.earned || 0;
            } else {
                // For other activities: use earned and base
                earnedXP = activity.earned || 0;
                possibleXP = activity.base || 10;
            }
            
            dailyGroups[dateKey].totalPossible += possibleXP;
            dailyGroups[dateKey].totalEarned += earnedXP;
        });
        
        const sortedDays = Object.values(dailyGroups).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Convert course Sets to arrays and detect transitions
        let previousCourse = null;
        sortedDays.forEach(day => {
            day.courses = Array.from(day.courses);
            day.courseTransition = false;
            
            // Check if this day has a different course than the previous day
            if (day.courses.length > 0) {
                const currentCourse = day.courses[0]; // Use first course of the day
                if (previousCourse && currentCourse !== previousCourse) {
                    day.courseTransition = true;
                    day.transitionFrom = previousCourse;
                    day.transitionTo = currentCourse;
                }
                previousCourse = currentCourse;
            }
        });
        
        return sortedDays;
    }

    /**
     * Get cumulative XP data for chart
     */
    static getCumulativeXPData(stats) {
        if (!stats.calculator || !stats.calculator.data) {
            return { 
                labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
                values: [12, 28, 41, 67, 85]
            };
        }


        const activities = stats.calculator.data
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (activities.length === 0) {
            return { 
                labels: ['Day 1', 'Day 2', 'Day 3'],
                values: [5, 12, 20]
            };
        }
        
        // Group by day 
        const dailyData = ChartHelpers.groupActivitiesByDay(activities);
        
        // Create complete date range from first to last activity day
        const firstDate = new Date(dailyData[0].date);
        const lastDate = new Date(dailyData[dailyData.length - 1].date);
        
        // Create lookup for daily XP and transitions
        const dailyXPLookup = {};
        const transitionLookup = {};
        dailyData.forEach(day => {
            dailyXPLookup[day.date] = day.xp;
            if (day.courseTransition) {
                transitionLookup[day.date] = {
                    from: day.transitionFrom,
                    to: day.transitionTo
                };
            }
        });
        
        // Generate cumulative data for ALL days (including zero-activity days)
        const data = [];
        let cumulativeXP = 0;
        const currentDate = new Date(firstDate);
        
        while (currentDate <= lastDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const dayXP = dailyXPLookup[dateKey] || 0; // 0 for days with no activities
            cumulativeXP += dayXP;
            
            data.push({
                date: dateKey,
                cumulative: cumulativeXP
            });
            
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        
        return {
            labels: data.map(d => d.date),
            values: data.map(d => d.cumulative),
            transitions: transitionLookup
        };
    }

    /**
     * Get cumulative activities data for chart
     */
    static getCumulativeActivitiesData(stats) {
        if (!stats.calculator || !stats.calculator.data) {
            return { 
                labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
                values: [2, 5, 7, 12]
            };
        }

        const activities = stats.calculator.data
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (activities.length === 0) {
            return { 
                labels: ['Day 1', 'Day 2'],
                values: [1, 2]
            };
        }
        
        // Group by day
        const dailyData = ChartHelpers.groupActivitiesByDay(activities);
        
        // Create complete date range from first to last activity day
        const firstDate = new Date(dailyData[0].date);
        const lastDate = new Date(dailyData[dailyData.length - 1].date);
        
        // Create lookup for daily activity count and transitions
        const dailyCountLookup = {};
        const transitionLookup = {};
        dailyData.forEach(day => {
            dailyCountLookup[day.date] = day.count;
            if (day.courseTransition) {
                transitionLookup[day.date] = {
                    from: day.transitionFrom,
                    to: day.transitionTo
                };
            }
        });
        
        // Generate cumulative data for ALL days (including zero-activity days)
        const data = [];
        let cumulativeCount = 0;
        const currentDate = new Date(firstDate);
        
        while (currentDate <= lastDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const dayCount = dailyCountLookup[dateKey] || 0; // 0 for days with no activities
            cumulativeCount += dayCount;
            
            data.push({
                date: dateKey,
                cumulative: cumulativeCount
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return {
            labels: data.map(d => d.date),
            values: data.map(d => d.cumulative),
            transitions: transitionLookup
        };
    }

    /**
     * Get average XP per day over time
     */
    static getAvgXPOverTimeData(stats) {
        if (!stats.calculator || !stats.calculator.data) {
            return { 
                labels: ['Week 1', 'Week 2', 'Week 3'],
                values: [108, 112, 115]
            };
        }

        const activities = stats.calculator.data
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (activities.length === 0) {
            return { 
                labels: ['Week 1', 'Week 2'],
                values: [110, 112]
            };
        }
        
        // Group by day
        const dailyData = ChartHelpers.groupActivitiesByDay(activities);
        
        // Create transition lookup
        const transitionLookup = {};
        dailyData.forEach(day => {
            if (day.courseTransition) {
                transitionLookup[day.date] = {
                    from: day.transitionFrom,
                    to: day.transitionTo
                };
            }
        });
        
        // Calculate 7-day rolling average for each day
        const data = [];
        for (let i = 0; i < dailyData.length; i++) {
            const windowStart = Math.max(0, i - 6); // 7 days including current day
            const window = dailyData.slice(windowStart, i + 1);
            
            const totalXP = window.reduce((sum, day) => sum + day.xp, 0);
            const rollingAvg = Math.round(totalXP / window.length);
            
            data.push({
                date: dailyData[i].date,
                avgXP: rollingAvg
            });
            
        }

        return {
            labels: data.map(d => d.date),
            values: data.map(d => d.avgXP),
            transitions: transitionLookup
        };
    }

    /**
     * Get success rate (attainment %) over time
     */
    static getSuccessRateOverTimeData(stats) {
        if (!stats.calculator || !stats.calculator.data) {
            return { 
                labels: ['Month 1', 'Month 2', 'Month 3'],
                values: [87, 86, 88]
            };
        }

        const activities = stats.calculator.data
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (activities.length === 0) {
            return { 
                labels: ['Month 1', 'Month 2'],
                values: [70, 80]
            };
        }
        
        // Group by day
        const dailyData = ChartHelpers.groupActivitiesByDay(activities);
        
        // Create transition lookup
        const transitionLookup = {};
        dailyData.forEach(day => {
            if (day.courseTransition) {
                transitionLookup[day.date] = {
                    from: day.transitionFrom,
                    to: day.transitionTo
                };
            }
        });
        
        // Calculate 7-day rolling attainment rate for each day
        const data = [];
        for (let i = 0; i < dailyData.length; i++) {
            const windowStart = Math.max(0, i - 6); // 7 days including current day
            const window = dailyData.slice(windowStart, i + 1);
            
            const totalEarned = window.reduce((sum, day) => sum + day.totalEarned, 0);
            const totalPossible = window.reduce((sum, day) => sum + day.totalPossible, 0);
            const rollingAttainment = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
            // No cap at 100% - allow >100% for perfect scores
            
            data.push({
                date: dailyData[i].date,
                successRate: rollingAttainment
            });
            
        }

        return {
            labels: data.map(d => d.date),
            values: data.map(d => d.successRate),
            transitions: transitionLookup
        };
    }

    /**
     * Sample data points for chart performance
     */
    static sampleData(data, maxPoints) {
        if (data.length <= maxPoints) return data;
        
        const step = Math.floor(data.length / maxPoints);
        const sampled = [];
        
        for (let i = 0; i < data.length; i += step) {
            sampled.push(data[i]);
        }
        
        // Always include the last point
        if (sampled[sampled.length - 1] !== data[data.length - 1]) {
            sampled.push(data[data.length - 1]);
        }
        
        return sampled;
    }

    /**
     * Calculate days between two dates
     */
    static daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((date1 - date2) / oneDay));
    }

    /**
     * Create chart configuration for inline charts
     */
    static createInlineChartConfig(data, color) {
        return {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    borderColor: color,
                    backgroundColor: color.replace(')', ', 0.1)').replace('rgb', 'rgba'),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { 
                        display: false,
                        grid: { display: false }
                    },
                    y: { 
                        display: false,
                        grid: { display: false }
                    }
                },
                elements: {
                    point: { radius: 0 }
                },
                layout: {
                    padding: 0
                },
                animation: {
                    duration: 0
                }
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartHelpers;
} else {
    window.ChartHelpers = ChartHelpers;
}