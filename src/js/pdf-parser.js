/**
 * PDF Data Parser
 * Parses MathAcademy activity data from PDF export files using PDF.js
 */

class PDFDataParser {
    constructor() {
        this.activities = [];
        
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
    }

    /**
     * Load and parse PDF file
     */
    async loadFromFile(filename = 'activity_log.pdf') {
        try {
            // Fetch the PDF file
            const response = await fetch(`/data/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load PDF: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Parse PDF with PDF.js
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = '';
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Combine text items with spaces
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            
            // Parse activities from extracted text
            this.activities = this.parseActivities(fullText);
            
            return this.activities;
            
        } catch (error) {
            console.error('Error loading PDF file:', error);
            return this.generateSampleData();
        }
    }

    /**
     * Parse activities from PDF text content
     */
    parseActivities(text) {
        const activities = [];
        
        // Find all date headers with their positions
        const datePattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/g;
        const dateMatches = [];
        let match;
        
        while ((match = datePattern.exec(text)) !== null) {
            dateMatches.push({
                date: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
        
        
        // Process each date section
        for (let i = 0; i < dateMatches.length; i++) {
            const currentDate = dateMatches[i];
            const nextDate = dateMatches[i + 1];
            
            // Extract text from end of current date to start of next date (or end of text)
            const sectionStart = currentDate.endIndex;
            const sectionEnd = nextDate ? nextDate.startIndex : text.length;
            const sectionText = text.substring(sectionStart, sectionEnd);
            
            if (sectionText.length > 10) { // Only process if section has meaningful content
                const sectionActivities = this.parseActivitySection(currentDate.date, sectionText);
                activities.push(...sectionActivities);
            }
        }
        
        const filteredActivities = activities.filter(activity => 
            activity.type && 
            activity.earned !== undefined && 
            activity.timestamp instanceof Date
        );
        
        return filteredActivities;
    }

    /**
     * Parse a section of activities for a specific date
     */
    parseActivitySection(dateStr, sectionText) {
        const activities = [];
        
        
        // Look for Placement and Supplemental activities with their XP values
        // Handle format: "Mathematical Foundations III   Placement   63 /   XP"
        const diagnosticRegex = /(Mathematical Foundations \w+)\s+(Placement|Supplemental)\s+(\d+)\s*\/\s*XP/g;
        let diagnosticMatch;
        const diagnosticActivities = [];
        
        while ((diagnosticMatch = diagnosticRegex.exec(sectionText)) !== null) {
            const [fullMatch, course, type, xpValue] = diagnosticMatch;
            const earnedXP = parseInt(xpValue) || 63;
            
            
            const parsedDate = this.parseDate(dateStr);
            diagnosticActivities.push({
                date: dateStr,
                timestamp: parsedDate,
                type: 'diagnostic', // Normalize to diagnostic
                course: course.trim(),
                title: `${type} Activity`,
                earned: earnedXP,
                maxXP: earnedXP, // For diagnostics, earned = max
                base: earnedXP,
                percentage: 100, // Diagnostics are typically 100%
                isSuccess: true,
                rawText: fullMatch
            });
        }
        
        // Then parse other activities normally
        const activityRegex = /(Mathematical Foundations \w+)\s+(Lesson|Review|Quiz|Diagnostic|Multistep)\s+(.*?)\s+(\d+)\s*\/\s*(\d+)\s*XP/g;
        
        let match;
        let matchCount = 0;
        while ((match = activityRegex.exec(sectionText)) !== null) {
            matchCount++;
            const [fullMatch, course, type, description, earnedXP, maxXP] = match;
            
            const parsedDate = this.parseDate(dateStr);
            
            const activity = {
                date: dateStr,
                timestamp: parsedDate,
                type: this.normalizeActivityType(type),
                course: course.trim(),
                title: description.trim(),
                earned: parseInt(earnedXP) || 0,
                maxXP: parseInt(maxXP) || parseInt(earnedXP) || 0,
                base: parseInt(maxXP) || parseInt(earnedXP) || 0, // Add base field for compatibility
                rawText: fullMatch
            };
            
            // Validate the parsed date
            if (isNaN(parsedDate.getTime())) {
                activity.timestamp = new Date(); // Fallback to current date
            }
            
            // Calculate percentage
            if (activity.base > 0) {
                activity.percentage = Math.round((activity.earned / activity.base) * 100);
            } else {
                activity.percentage = 100; // If no max XP, assume 100%
            }
            
            activity.isSuccess = activity.percentage >= 70;
            
            activities.push(activity);
        }
        
        // Add the diagnostic activities we found
        activities.push(...diagnosticActivities);
        
        return activities;
    }

    /**
     * Generate sample data as fallback
     */
    generateSampleData() {
        const sampleActivities = [
            { type: 'lessons', earned: 20, maxXP: 20, date: 'Oct 16, 2025', time: '10:30 AM', course: 'Mathematical Foundations III' },
            { type: 'reviews', earned: 15, maxXP: 20, date: 'Oct 16, 2025', time: '11:15 AM', course: 'Mathematical Foundations III' },
            { type: 'quizzes', earned: 18, maxXP: 20, date: 'Oct 15, 2025', time: '2:45 PM', course: 'Mathematical Foundations III' },
            { type: 'diagnostics', earned: 25, maxXP: 30, date: 'Oct 14, 2025', time: '9:20 AM', course: 'Mathematical Foundations II' },
            { type: 'multisteps', earned: 22, maxXP: 25, date: 'Oct 14, 2025', time: '3:10 PM', course: 'Mathematical Foundations II' }
        ];
        
        return sampleActivities.map(activity => {
            activity.timestamp = this.parseDateTime(activity.date, activity.time);
            activity.base = activity.maxXP; // Add base field for compatibility
            activity.percentage = Math.round((activity.earned / activity.base) * 100);
            activity.isSuccess = activity.percentage >= 70;
            activity.title = `Sample ${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}`;
            return activity;
        });
    }

    /**
     * Parse date string into Date object
     */
    parseDate(dateStr) {
        try {
            // Handle formats like "Thu, Oct 16th, 2025" or "Mon, Sep 1st, 2025"
            // Remove ordinal suffixes (st, nd, rd, th) and day name
            let cleanDateStr = dateStr
                .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/, '') // Remove day name
                .replace(/(\d+)(st|nd|rd|th)/, '$1'); // Remove ordinal suffixes
            
            const parsed = new Date(cleanDateStr);
            
            if (isNaN(parsed.getTime())) {
                return new Date(); // Current date as fallback
            }
            
            return parsed;
        } catch (error) {
            return new Date();
        }
    }

    /**
     * Parse date and time into a proper Date object
     */
    parseDateTime(dateStr, timeStr) {
        try {
            const fullDateTimeStr = `${dateStr} ${timeStr}`;
            return new Date(fullDateTimeStr);
        } catch (error) {
            return this.parseDate(dateStr);
        }
    }

    /**
     * Normalize activity type names to match existing format
     */
    normalizeActivityType(type) {
        if (!type) return 'lesson';
        
        const normalizedType = type.toLowerCase().trim();
        
        switch (normalizedType) {
            case 'lesson':
            case 'lessons':
                return 'lesson';
            case 'review':
            case 'reviews':
                return 'review';
            case 'quiz':
            case 'quizzes':
                return 'quiz';
            case 'diagnostic':
            case 'diagnostics':
            case 'placement':
            case 'supplemental':
                return 'diagnostic';
            case 'multistep':
            case 'multisteps':
            case 'practice':
                return 'multistep';
            default:
                return 'lesson'; // Default to lesson for unknown types
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFDataParser;
} else {
    window.PDFDataParser = PDFDataParser;
}