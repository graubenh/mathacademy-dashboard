/**
 * Statistics Calculator
 * Processes parsed activity data to generate insights and metrics
 */

class StatisticsCalculator {
    constructor(data = []) {
        this.data = data;
    }

    /**
     * Update data for calculations
     */
    setData(data) {
        this.data = data;
    }

    /**
     * Calculate comprehensive statistics
     */
    calculateStats() {
        if (!this.data || this.data.length === 0) {
            return this.getEmptyStats();
        }

        const stats = {
            totalXP: this.calculateTotalXP(),
            totalActivities: this.data.length,
            activityCounts: this.calculateActivityCounts(),
            successMetrics: this.calculateSuccessMetrics(),
            avgXPPerDay: this.calculateAvgXPPerDay(),
            dailyStats: this.calculateDailyStats(),
            weekdayStats: this.calculateWeekdayStats(),
            bestPerformance: this.calculateBestPerformance(),
            last14Days: this.getLast14Days(),
            timeAnalysis: this.calculateTimeAnalysis()
        };

        return stats;
    }

    /**
     * Calculate total XP earned
     */
    calculateTotalXP() {
        return this.data.reduce((sum, activity) => sum + activity.earned, 0);
    }

    /**
     * Calculate activity type counts
     */
    calculateActivityCounts() {
        const counts = {
            diagnostics: 0,
            lessons: 0,
            reviews: 0,
            multisteps: 0,
            quizzes: 0
        };

        this.data.forEach(activity => {
            const originalType = activity.type;
            const type = originalType.toLowerCase();
            const taskName = activity.taskName || '';
            
            // Check if it's a quiz by name (since quizzes are labeled as "Assessment")
            if (taskName.toLowerCase().includes('quiz')) {
                counts.quizzes++;
            } else {
                switch (type) {
                    case 'diagnostic':
                    case 'assessment':
                    case 'supplemental diagnostic':
                        counts.diagnostics++;
                        break;
                    case 'lesson':
                        counts.lessons++;
                        break;
                    case 'review':
                        counts.reviews++;
                        break;
                    case 'multistep':
                        counts.multisteps++;
                        break;
                    case 'quiz':
                        counts.quizzes++;
                        break;
                    default:
                        // Unknown activity type - skip
                        break;
                }
            }
        });

        return counts;
    }

    /**
     * Calculate success metrics (perfect, pass, fail)
     */
    calculateSuccessMetrics() {
        let perfectCount = 0;
        let passCount = 0;
        let failCount = 0;

        this.data.forEach(activity => {
            const type = activity.type.toLowerCase();
            const taskName = activity.taskName || '';
            const isQuiz = taskName.toLowerCase().includes('quiz');
            const isDiagnostic = !isQuiz && (type === 'diagnostic' || type === 'assessment' || type === 'supplemental diagnostic');
            
            // For diagnostics (but not quizzes), treat them as always at target (pass)
            // since they don't have traditional XP targets
            if (isDiagnostic) {
                if (activity.earned > 0) {
                    passCount++; // Diagnostics are always "pass" if completed
                } else {
                    failCount++;
                }
            } else {
                // For other activities (including quizzes), use normal logic
                if (activity.earned > activity.base) {
                    perfectCount++;
                } else if (activity.earned > 0 && activity.earned <= activity.base) {
                    passCount++;
                } else {
                    failCount++;
                }
            }
        });

        // Calculate XP attainment rate (percentage of possible XP achieved)
        let totalEarned = 0;
        let totalPossible = 0;
        
        this.data.forEach(activity => {
            const type = activity.type.toLowerCase();
            const taskName = activity.taskName || '';
            const isQuiz = taskName.toLowerCase().includes('quiz');
            const isDiagnostic = !isQuiz && (type === 'diagnostic' || type === 'assessment' || type === 'supplemental diagnostic');
            
            // For diagnostics, use earned as both earned and possible (100% attainment)
            if (isDiagnostic) {
                totalEarned += activity.earned;
                totalPossible += activity.earned; // Diagnostics are always at 100% of their potential
            } else {
                totalEarned += activity.earned;
                totalPossible += activity.base;
            }
        });

        const xpAttainmentRate = totalPossible > 0 ? (totalEarned / totalPossible * 100) : 0;

        return {
            perfectCount,
            passCount,
            failCount,
            successRate: Math.round(xpAttainmentRate * 10) / 10,
            totalEarned,
            totalPossible
        };
    }

    /**
     * Calculate daily statistics
     */
    calculateDailyStats() {
        const dailyStats = {};

        this.data.forEach(activity => {
            const date = new Date(activity.timestamp);
            const dateKey = date.toDateString();
            
            if (!dailyStats[dateKey]) {
                dailyStats[dateKey] = {
                    date: date,
                    xp: 0,
                    earned: 0,
                    base: 0,
                    count: 0,
                    activities: []
                };
            }
            
            dailyStats[dateKey].xp += activity.earned;
            dailyStats[dateKey].earned += activity.earned;
            dailyStats[dateKey].base += activity.base;
            dailyStats[dateKey].count++;
            dailyStats[dateKey].activities.push(activity);
        });

        return dailyStats;
    }

    /**
     * Calculate average XP per day
     */
    calculateAvgXPPerDay() {
        const dailyStats = this.calculateDailyStats();
        const uniqueDays = Object.keys(dailyStats).length;
        const totalXP = this.calculateTotalXP();
        
        return uniqueDays > 0 ? Math.round(totalXP / uniqueDays) : 0;
    }

    /**
     * Calculate weekday statistics
     */
    calculateWeekdayStats() {
        const weekdayStats = Array(7).fill(null).map(() => ({ xp: 0, count: 0 }));
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        this.data.forEach(activity => {
            const date = new Date(activity.timestamp);
            const day = date.getDay();
            
            if (weekdayStats[day] && !isNaN(day) && day >= 0 && day <= 6) {
                weekdayStats[day].xp += activity.earned || 0;
                weekdayStats[day].count++;
            } else {
                console.warn(`Invalid day index: ${day} for activity:`, activity);
            }
        });

        let bestWeekday = '';
        let bestWeekdayAvg = 0;
        
        weekdayStats.forEach((stats, index) => {
            const avg = stats.count > 0 ? stats.xp / stats.count : 0;
            if (avg > bestWeekdayAvg) {
                bestWeekdayAvg = avg;
                bestWeekday = weekdayNames[index];
            }
        });

        return {
            weekdayStats,
            bestWeekday,
            bestWeekdayAvg: Math.round(bestWeekdayAvg)
        };
    }

    /**
     * Calculate best performance metrics
     */
    calculateBestPerformance() {
        const dailyStats = this.calculateDailyStats();
        
        let bestDayXP = 0;
        let bestDayDate = '';
        let bestAccuracy = 0;
        let bestAccuracyDate = '';

        Object.entries(dailyStats).forEach(([dateKey, stats]) => {
            // Best day by XP
            if (stats.xp > bestDayXP) {
                bestDayXP = stats.xp;
                bestDayDate = dateKey;
            }
            
            // Best day by accuracy (excluding diagnostics since they don't have meaningful base XP)
            let nonDiagnosticEarned = 0;
            let nonDiagnosticBase = 0;
            
            stats.activities.forEach(activity => {
                const type = activity.type.toLowerCase();
                const taskName = activity.taskName || '';
                const isQuiz = taskName.toLowerCase().includes('quiz');
                const isDiagnostic = !isQuiz && (type === 'diagnostic' || type === 'assessment' || type === 'supplemental diagnostic');
                
                if (!isDiagnostic) {
                    nonDiagnosticEarned += activity.earned;
                    nonDiagnosticBase += activity.base;
                }
            });
            
            const accuracy = nonDiagnosticBase > 0 ? (nonDiagnosticEarned / nonDiagnosticBase) * 100 : 0;
            if (accuracy > bestAccuracy && nonDiagnosticBase > 0) {
                bestAccuracy = accuracy;
                bestAccuracyDate = dateKey;
            }
        });

        return {
            bestDayXP,
            bestDayDate,
            bestAccuracy: Math.round(bestAccuracy * 10) / 10,
            bestAccuracyDate
        };
    }

    /**
     * Get last 14 days for chart
     */
    getLast14Days() {
        const today = new Date();
        const dailyStats = this.calculateDailyStats();
        const last14Days = [];

        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();
            
            last14Days.push({
                date: date,
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                xp: dailyStats[dateKey] ? dailyStats[dateKey].xp : 0,
                count: dailyStats[dateKey] ? dailyStats[dateKey].count : 0
            });
        }

        return last14Days;
    }

    /**
     * Calculate time-based analysis
     */
    calculateTimeAnalysis() {
        const hourlyStats = Array(24).fill(null).map(() => ({ xp: 0, count: 0 }));
        
        this.data.forEach(activity => {
            const date = new Date(activity.timestamp);
            const hour = date.getHours();
            hourlyStats[hour].xp += activity.earned;
            hourlyStats[hour].count++;
        });

        // Find most productive hour
        let mostProductiveHour = 0;
        let maxHourlyXP = 0;
        
        hourlyStats.forEach((stats, hour) => {
            if (stats.xp > maxHourlyXP) {
                maxHourlyXP = stats.xp;
                mostProductiveHour = hour;
            }
        });

        const formatHour = (hour) => {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:00 ${ampm}`;
        };

        return {
            hourlyStats,
            mostProductiveHour: formatHour(mostProductiveHour),
            maxHourlyXP
        };
    }

    /**
     * Filter data by time period
     */
    filterByPeriod(period) {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'all':
            default:
                return new StatisticsCalculator(this.data);
        }

        const filteredData = this.data.filter(activity => {
            const activityDate = new Date(activity.timestamp);
            return activityDate >= startDate;
        });

        return new StatisticsCalculator(filteredData);
    }

    /**
     * Get empty stats structure
     */
    getEmptyStats() {
        return {
            totalXP: 0,
            totalActivities: 0,
            activityCounts: {
                diagnostics: 0,
                lessons: 0,
                reviews: 0,
                multisteps: 0,
                quizzes: 0
            },
            successMetrics: {
                perfectCount: 0,
                passCount: 0,
                failCount: 0,
                successRate: 0
            },
            avgXPPerDay: 0,
            dailyStats: {},
            weekdayStats: {
                weekdayStats: Array(7).fill({ xp: 0, count: 0 }),
                bestWeekday: '',
                bestWeekdayAvg: 0
            },
            bestPerformance: {
                bestDayXP: 0,
                bestDayDate: '',
                bestAccuracy: 0,
                bestAccuracyDate: ''
            },
            last14Days: [],
            timeAnalysis: {
                hourlyStats: Array(24).fill({ xp: 0, count: 0 }),
                mostProductiveHour: '',
                maxHourlyXP: 0
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsCalculator;
} else {
    window.StatisticsCalculator = StatisticsCalculator;
}