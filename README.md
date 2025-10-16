# MathAcademy Analytics Dashboard

A clean, responsive dashboard for visualizing MathAcademy learning progress and statistics.

## Features

- **Current Course Display**: Shows your current course based on recent activity
- **Progress Statistics**: Total XP, activities completed, average XP/day, and attainment rate
- **Activity Breakdown**: Count of lessons, reviews, multisteps, quizzes, and diagnostics
- **Interactive Charts**: Visual progress tracking with course transition markers
- **Time Period Filtering**: View stats for all time, this week, or today
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **Responsive Design**: Works on desktop and mobile devices

## File Structure

```
├── index.html              # Main dashboard page
├── data/
│   └── *.pdf              # MathAcademy activity log PDFs
└── src/
    ├── css/
    │   ├── main.css       # Core styles and layout
    │   └── components.css # Component-specific styles
    └── js/
        ├── pdf-parser.js  # PDF data extraction
        ├── statistics.js  # Data analysis and calculations
        ├── chart-helpers.js # Chart data preparation
        └── ui.js          # UI rendering and interactions
```

## Usage

1. **Local Development**: Open `index.html` in a web browser
2. **GitHub Pages**: Upload to GitHub repository and enable Pages
3. **Daily Updates**: Replace the PDF file in the `data/` folder

## Dependencies

- [Chart.js](https://www.chartjs.org/) - Chart rendering
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF text extraction

## Browser Support

Modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge).