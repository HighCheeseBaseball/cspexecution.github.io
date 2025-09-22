class BaseballChartingApp {
    constructor() {
        this.currentPitch = {
            catcherGlove: null,
            ballLocation: null,
            step: 'catcher' // 'catcher' or 'ball'
        };
        this.pitchHistory = [];
        this.pitchCounter = 0;
        this.selectedPitchType = 'FS'; // Default to Four-Seam
        this.selectedPitchColor = 'darkred';
        
        // Strike zone dimensions: 17" wide x 24" tall (approximate)
        // Our CSS strike zone is 306px wide x 306px tall (3 zones x 100px + 2px gaps)
        this.pixelsPerInch = 306 / 17; // ~18 pixels per inch
        
        // Preload logo for PDF reports
        this.logoImg = new Image();
        this.logoImg.src = 'cressey_logo.png';
        this.logoLoaded = false;
        this.logoImg.onload = () => {
            this.logoLoaded = true;
        };
        this.logoImg.onerror = () => {
            this.logoLoaded = false;
        };
        
        this.init();
    }
    
    init() {
        this.strikeZone = document.querySelector('.strike-zone');
        this.statusElement = document.getElementById('current-pitch-status');
        this.distanceScoreElement = document.getElementById('distance-score');
        this.pitchCounterElement = document.getElementById('pitch-counter');
        this.historyElement = document.getElementById('history-list');
        this.clearButton = document.getElementById('clear-pitch');
        this.resetButton = document.getElementById('reset-all');
        this.showPlotButton = document.getElementById('show-plot');
        this.plotModal = document.getElementById('plot-modal');
        this.closePlotButton = document.getElementById('close-plot');
        this.pitchPlotCanvas = document.getElementById('pitch-plot');
        this.pitchTypeButtons = document.querySelectorAll('.pitch-type-btn');
        this.overallScoreElement = document.getElementById('overall-score');
        this.breakdownTableBody = document.getElementById('breakdown-body');
        this.exportCSVButton = document.getElementById('export-csv');
        this.exportReportButton = document.getElementById('export-report');
        this.pitcherNameInput = document.getElementById('pitcher-name');
        
        this.setupEventListeners();
        this.updateStatus();
    }
    
    setupEventListeners() {
        // Zone box clicks
        document.querySelectorAll('.zone-box').forEach(box => {
            box.addEventListener('click', (e) => this.handleZoneClick(e));
        });
        
        // Strike zone area clicks (including outside the boxes)
        this.strikeZone.addEventListener('click', (e) => this.handleStrikeZoneClick(e));
        
        // Control buttons
        this.clearButton.addEventListener('click', () => this.clearCurrentPitch());
        this.resetButton.addEventListener('click', () => this.resetAll());
        this.showPlotButton.addEventListener('click', () => this.showPlot());
        this.closePlotButton.addEventListener('click', () => this.hidePlot());
        this.exportCSVButton.addEventListener('click', () => this.exportCSV());
        this.exportReportButton.addEventListener('click', () => this.exportReport());
        
        // Pitch type buttons
        this.pitchTypeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectPitchType(e));
        });
        
        // Close plot modal when clicking outside
        this.plotModal.addEventListener('click', (e) => {
            if (e.target === this.plotModal) {
                this.hidePlot();
            }
        });
    }
    
    handleZoneClick(event) {
        event.stopPropagation(); // Prevent triggering strike zone click
        const zoneBox = event.target;
        const rect = zoneBox.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const zoneNumber = parseInt(zoneBox.dataset.zone);
        
        if (this.currentPitch.step === 'catcher') {
            this.setCatcherGlove(zoneBox, x, y, zoneNumber);
        } else if (this.currentPitch.step === 'ball') {
            this.setBallLocation(zoneBox, x, y, zoneNumber);
        }
    }
    
    handleStrikeZoneClick(event) {
        // Handle clicks outside the zone boxes (for pitches way outside the zone)
        if (event.target.classList.contains('zone-box')) {
            return; // Let zone click handler deal with it
        }
        
        const strikeZoneRect = this.strikeZone.getBoundingClientRect();
        const x = event.clientX - strikeZoneRect.left;
        const y = event.clientY - strikeZoneRect.top;
        
        // Determine which "virtual zone" this click is in (for outside pitches)
        const zoneNumber = this.getVirtualZone(x, y, strikeZoneRect);
        
        if (this.currentPitch.step === 'catcher') {
            this.setCatcherGlove(this.strikeZone, x, y, zoneNumber, true);
        } else if (this.currentPitch.step === 'ball') {
            this.setBallLocation(this.strikeZone, x, y, zoneNumber, true);
        }
    }
    
    getVirtualZone(x, y, strikeZoneRect) {
        // Map clicks to the closest zone (1-9) even if outside
        const padding = 60;
        const zoneWidth = 100 + 2; // 100px + 2px gap
        const zoneHeight = 100 + 2;
        
        // Adjust coordinates relative to the zone grid
        const gridX = x - padding;
        const gridY = y - padding;
        
        // Find closest zone
        const col = Math.max(0, Math.min(2, Math.floor(gridX / zoneWidth)));
        const row = Math.max(0, Math.min(2, Math.floor(gridY / zoneHeight)));
        
        return row * 3 + col + 1;
    }
    
    setCatcherGlove(container, x, y, zoneNumber, isOutside = false) {
        // Remove any existing catcher glove marker
        this.clearCatcherGlove();
        
        // Create catcher glove marker
        const gloveMarker = document.createElement('div');
        gloveMarker.className = 'catcher-glove';
        gloveMarker.style.left = x + 'px';
        gloveMarker.style.top = y + 'px';
        container.appendChild(gloveMarker);
        
        // Store the position (adjust coordinates if outside zone)
        let adjustedX = x;
        let adjustedY = y;
        
        if (isOutside) {
            // Convert strike zone coordinates to zone-relative coordinates
            const padding = 60;
            const zoneWidth = 102; // 100px + 2px gap
            const zoneHeight = 102;
            
            const zoneRow = Math.floor((zoneNumber - 1) / 3);
            const zoneCol = (zoneNumber - 1) % 3;
            
            adjustedX = x - padding - (zoneCol * zoneWidth);
            adjustedY = y - padding - (zoneRow * zoneHeight);
        }
        
        this.currentPitch.catcherGlove = {
            zone: zoneNumber,
            x: adjustedX,
            y: adjustedY,
            element: gloveMarker,
            container: container,
            isOutside: isOutside
        };
        
        // Move to next step
        this.currentPitch.step = 'ball';
        this.updateStatus();
    }
    
    setBallLocation(container, x, y, zoneNumber, isOutside = false) {
        // Remove any existing ball location marker
        this.clearBallLocation();
        
        // Create ball location marker
        const ballMarker = document.createElement('div');
        ballMarker.className = 'ball-location';
        ballMarker.style.left = x + 'px';
        ballMarker.style.top = y + 'px';
        container.appendChild(ballMarker);
        
        // Store the position (adjust coordinates if outside zone)
        let adjustedX = x;
        let adjustedY = y;
        
        if (isOutside) {
            // Convert strike zone coordinates to zone-relative coordinates
            const padding = 60;
            const zoneWidth = 102; // 100px + 2px gap
            const zoneHeight = 102;
            
            const zoneRow = Math.floor((zoneNumber - 1) / 3);
            const zoneCol = (zoneNumber - 1) % 3;
            
            adjustedX = x - padding - (zoneCol * zoneWidth);
            adjustedY = y - padding - (zoneRow * zoneHeight);
        }
        
        // If zone is invalid, check if it should match the catcher zone (perfect strike)
        if (isNaN(zoneNumber) || !zoneNumber || zoneNumber < 1 || zoneNumber > 9) {
            if (this.currentPitch.catcherGlove) {
                // Check if click coordinates are close to catcher coordinates (within 60px = perfect strike)
                const catcherX = this.currentPitch.catcherGlove.element.offsetLeft;
                const catcherY = this.currentPitch.catcherGlove.element.offsetTop;
                const clickDistance = Math.sqrt(Math.pow(x - catcherX, 2) + Math.pow(y - catcherY, 2));
                
                console.log('Zone invalid, checking perfect strike:', {
                    originalZone: zoneNumber,
                    catcherZone: this.currentPitch.catcherGlove.zone,
                    clickDistance: clickDistance,
                    catcherX: catcherX,
                    catcherY: catcherY,
                    clickX: x,
                    clickY: y
                });
                
                if (clickDistance <= 60) { // Perfect strike - use catcher's zone and position
                    zoneNumber = this.currentPitch.catcherGlove.zone;
                    adjustedX = this.currentPitch.catcherGlove.x;
                    adjustedY = this.currentPitch.catcherGlove.y;
                    isOutside = this.currentPitch.catcherGlove.isOutside;
                    console.log('Perfect strike detected, using catcher zone:', zoneNumber);
                } else {
                    console.log('Not a perfect strike, distance too far:', clickDistance);
                }
            }
        }
        
        this.currentPitch.ballLocation = {
            zone: zoneNumber,
            x: adjustedX,
            y: adjustedY,
            element: ballMarker,
            container: container,
            isOutside: isOutside
        };
        
        // Calculate and display distance score
        this.displayDistanceScore();
        
        // Complete the pitch
        this.completePitch();
    }
    
    completePitch() {
        // Calculate distance before clearing
        const distancePixels = this.calculatePixelDistance();
        let distanceInches = distancePixels / this.pixelsPerInch;
        
        // Handle edge cases
        if (isNaN(distanceInches) || !isFinite(distanceInches)) {
            distanceInches = 0.0;
        }
        
        // If distance is 0 but ball zone is invalid, fix it
        if (distanceInches === 0 && (isNaN(this.currentPitch.ballLocation.zone) || !this.currentPitch.ballLocation.zone)) {
            console.log('Distance is 0 but ball zone is invalid, fixing...');
            this.currentPitch.ballLocation.zone = this.currentPitch.catcherGlove.zone;
            this.currentPitch.ballLocation.x = this.currentPitch.catcherGlove.x;
            this.currentPitch.ballLocation.y = this.currentPitch.catcherGlove.y;
            console.log('Fixed ball zone to:', this.currentPitch.ballLocation.zone);
        }
        
        const score = this.getDistanceScore(distanceInches);
        
        // Add to pitch history
        this.pitchCounter++;
        const pitchData = {
            number: this.pitchCounter,
            pitchType: this.selectedPitchType,
            pitchTypeName: this.getPitchTypeName(this.selectedPitchType),
            pitchColor: this.selectedPitchColor,
            catcherGlove: { ...this.currentPitch.catcherGlove },
            ballLocation: { ...this.currentPitch.ballLocation },
            timestamp: new Date().toLocaleTimeString()
        };
        
        console.log('Storing pitch data:', {
            catcherZone: pitchData.catcherGlove.zone,
            ballZone: pitchData.ballLocation.zone,
            distance: distanceInches
        });
        
        this.pitchHistory.push(pitchData);
        this.updatePitchHistory();
        this.updatePitchCounter();
        this.updateOverallCommandScore();
        this.updateCommandBreakdown();
        
        // Show completion message with actual distance and color-coded text
        this.statusElement.textContent = `Pitch #${this.pitchCounter} - ${distanceInches.toFixed(1)}" - ${score.grade} | Ready for next pitch...`;
        
        // Set color based on command grade
        switch(score.class) {
            case 'excellent':
                this.statusElement.style.color = '#00ff00'; // Green
                break;
            case 'good':
                this.statusElement.style.color = '#0066ff'; // Blue
                break;
            case 'average':
                this.statusElement.style.color = '#ffff00'; // Yellow
                break;
            case 'fair':
                this.statusElement.style.color = '#ff8800'; // Orange
                break;
            case 'poor':
                this.statusElement.style.color = '#ff0000'; // Red
                break;
            default:
                this.statusElement.style.color = '#fff'; // White fallback
        }
        
        // Hide the distance score box immediately after completion
        this.hideDistanceScore();
        
        // Auto-advance to next pitch after 2 seconds (slightly longer to read the distance)
        setTimeout(() => {
            this.clearCurrentPitch();
            this.updateStatus();
        }, 2000);
    }
    
    clearCatcherGlove() {
        if (this.currentPitch.catcherGlove) {
            this.currentPitch.catcherGlove.element.remove();
            this.currentPitch.catcherGlove = null;
        }
    }
    
    clearBallLocation() {
        if (this.currentPitch.ballLocation) {
            this.currentPitch.ballLocation.element.remove();
            this.currentPitch.ballLocation = null;
        }
    }
    
    clearCurrentPitch() {
        this.clearCatcherGlove();
        this.clearBallLocation();
        this.hideDistanceScore();
        this.resetCurrentPitch();
        this.updateStatus();
    }
    
    resetCurrentPitch() {
        this.currentPitch = {
            catcherGlove: null,
            ballLocation: null,
            step: 'catcher'
        };
    }
    
    resetAll() {
        if (confirm('Are you sure you want to reset all pitches? This will clear all history.')) {
            this.clearCurrentPitch();
            this.pitchHistory = [];
            this.pitchCounter = 0;
            this.updatePitchHistory();
            this.updatePitchCounter();
            this.updateOverallCommandScore();
            this.updateCommandBreakdown();
            
            // Clear all zone markers
            document.querySelectorAll('.catcher-glove, .ball-location').forEach(marker => {
                marker.remove();
            });
            
            this.hideDistanceScore();
        }
    }
    
    selectPitchType(event) {
        // Remove active class from all buttons
        this.pitchTypeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        event.target.classList.add('active');
        
        // Update selected pitch type and color
        this.selectedPitchType = event.target.dataset.pitch;
        this.selectedPitchColor = event.target.dataset.color;
    }
    
    getPitchTypeName(code) {
        const pitchTypes = {
            'FS': 'Four-Seam',
            'CH': 'ChangeUp',
            'CB': 'Curveball',
            'CT': 'Cutter',
            'KN': 'Knuckleball',
            'SI': 'Sinker',
            'SP': 'Splitter',
            'SW': 'Sweeper',
            'SL': 'Slider'
        };
        return pitchTypes[code] || code;
    }
    
    updateStatus() {
        if (this.currentPitch.step === 'catcher') {
            this.statusElement.textContent = 'Click to mark the catcher\'s glove position...';
            this.statusElement.style.color = '#ff6b35';
        } else if (this.currentPitch.step === 'ball') {
            this.statusElement.textContent = 'Now click where the ball crossed the plate...';
            this.statusElement.style.color = '#fff';
        }
    }
    
    displayDistanceScore() {
        const distancePixels = this.calculatePixelDistance();
        const distanceInches = distancePixels / this.pixelsPerInch;
        
        // Handle edge cases
        if (isNaN(distanceInches) || !isFinite(distanceInches)) {
            this.distanceScoreElement.textContent = `Distance: 0.0" - Excellent Command`;
            this.distanceScoreElement.className = `distance-score excellent`;
            this.distanceScoreElement.style.display = 'block';
            return;
        }
        
        const score = this.getDistanceScore(distanceInches);
        
        this.distanceScoreElement.textContent = `Distance: ${distanceInches.toFixed(1)}" - ${score.grade}`;
        this.distanceScoreElement.className = `distance-score ${score.class}`;
        this.distanceScoreElement.style.display = 'block';
    }
    
    hideDistanceScore() {
        this.distanceScoreElement.style.display = 'none';
    }
    
    calculatePixelDistance() {
        if (!this.currentPitch.catcherGlove || !this.currentPitch.ballLocation) {
            return 0;
        }
        
        const glove = this.currentPitch.catcherGlove;
        const ball = this.currentPitch.ballLocation;
        
        // Ensure we have valid coordinates
        if (typeof glove.x !== 'number' || typeof glove.y !== 'number' || 
            typeof ball.x !== 'number' || typeof ball.y !== 'number') {
            return 0;
        }
        
        // Calculate distance using stored relative positions
        // If same zone, use relative positions within the zone
        if (glove.zone === ball.zone) {
            const deltaX = ball.x - glove.x;
            const deltaY = ball.y - glove.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            return isNaN(distance) ? 0 : distance;
        }
        
        // If different zones, calculate based on zone positions plus relative positions
        // Each zone is 100px, with 2px gap
        const getZoneCenter = (zone) => {
            const row = Math.floor((zone - 1) / 3);
            const col = (zone - 1) % 3;
            return {
                x: col * 102 + 51, // 100px + 2px gap, center at 51
                y: row * 102 + 51
            };
        };
        
        const gloveCenter = getZoneCenter(glove.zone);
        const ballCenter = getZoneCenter(ball.zone);
        
        const gloveAbsX = gloveCenter.x + (glove.x - 51);
        const gloveAbsY = gloveCenter.y + (glove.y - 51);
        const ballAbsX = ballCenter.x + (ball.x - 51);
        const ballAbsY = ballCenter.y + (ball.y - 51);
        
        const deltaX = ballAbsX - gloveAbsX;
        const deltaY = ballAbsY - gloveAbsY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        return isNaN(distance) ? 0 : distance;
    }
    
    getDistanceScore(distanceInches) {
        if (distanceInches < 6.0) {
            return { grade: 'Excellent Command', class: 'excellent' };
        } else if (distanceInches >= 6.0 && distanceInches < 10.0) {
            return { grade: 'Good Command', class: 'good' };
        } else if (distanceInches >= 10.0 && distanceInches < 14.0) {
            return { grade: 'Average Command', class: 'average' };
        } else if (distanceInches >= 14.0 && distanceInches <= 17.0) {
            return { grade: 'Fair Command', class: 'fair' };
        } else {
            return { grade: 'Poor Command', class: 'poor' };
        }
    }
    
    updatePitchCounter() {
        this.pitchCounterElement.textContent = this.pitchCounter;
    }
    
    updatePitchHistory() {
        this.historyElement.innerHTML = '';
        
        // Show most recent pitches first
        const recentPitches = [...this.pitchHistory].reverse().slice(0, 10);
        
        recentPitches.forEach(pitch => {
            const entry = document.createElement('div');
            entry.className = 'pitch-entry';
            
            const distancePixels = this.calculateHistoricalDistance(pitch);
            const distanceInches = distancePixels / this.pixelsPerInch;
            const score = this.getDistanceScore(distanceInches);
            
            entry.innerHTML = `
                <div class="pitch-number">Pitch #${pitch.number} - ${pitch.pitchTypeName} - ${pitch.timestamp}</div>
                <div class="pitch-details">
                    <strong>Distance:</strong> ${distanceInches.toFixed(1)}" - ${score.grade}<br>
                    <strong>Catcher Target:</strong> Zone ${pitch.catcherGlove.zone}<br>
                    <strong>Ball Location:</strong> Zone ${pitch.ballLocation.zone}
                </div>
            `;
            
            this.historyElement.appendChild(entry);
        });
        
        if (this.pitchHistory.length === 0) {
            this.historyElement.innerHTML = '<p style="text-align: center; color: #666;">No pitches recorded yet</p>';
        }
    }
    
    calculateHistoricalDistance(pitch) {
        // Calculate distance using stored relative positions
        const glove = pitch.catcherGlove;
        const ball = pitch.ballLocation;
        
        // Ensure we have valid coordinates
        if (!glove || !ball || 
            typeof glove.x !== 'number' || typeof glove.y !== 'number' ||
            typeof ball.x !== 'number' || typeof ball.y !== 'number') {
            return 0;
        }
        
        // If same zone, use relative positions within the zone
        if (glove.zone === ball.zone) {
            const deltaX = ball.x - glove.x;
            const deltaY = ball.y - glove.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            return isNaN(distance) || !isFinite(distance) ? 0 : distance;
        }
        
        // If different zones, calculate based on zone positions plus relative positions
        // Each zone is 100px, with 2px gap (total strike zone: 306px = 17 inches)
        const getZoneCenter = (zone) => {
            const row = Math.floor((zone - 1) / 3);
            const col = (zone - 1) % 3;
            return {
                x: col * 102 + 51, // 100px + 2px gap, center at 51
                y: row * 102 + 51
            };
        };
        
        const gloveCenter = getZoneCenter(glove.zone);
        const ballCenter = getZoneCenter(ball.zone);
        
        const gloveAbsX = gloveCenter.x + (glove.x - 51);
        const gloveAbsY = gloveCenter.y + (glove.y - 51);
        const ballAbsX = ballCenter.x + (ball.x - 51);
        const ballAbsY = ballCenter.y + (ball.y - 51);
        
        const deltaX = ballAbsX - gloveAbsX;
        const deltaY = ballAbsY - gloveAbsY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        return isNaN(distance) || !isFinite(distance) ? 0 : distance;
    }
    
    showPlot() {
        if (this.pitchHistory.length === 0) {
            alert('No pitches to display. Chart some pitches first!');
            return;
        }
        
        this.plotModal.style.display = 'flex';
        this.drawPitchPlot();
        this.updatePlotLegend();
    }
    
    hidePlot() {
        this.plotModal.style.display = 'none';
    }
    
    drawPitchPlot() {
        const canvas = this.pitchPlotCanvas;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with white background to match PDF
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate strike zone area (centered, with padding for outside pitches)
        const padding = 60; // Space for pitches outside the zone
        const zoneSize = canvas.width - (padding * 2);
        const zoneStartX = padding;
        const zoneStartY = padding;
        
        // Draw strike zone background to match main page
        ctx.fillStyle = '#000000';
        ctx.fillRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw zone boxes with gaps to match main page
        const boxSize = (zoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const x = zoneStartX + col * (boxSize + gap);
                const y = zoneStartY + row * (boxSize + gap);
                
                // Draw box background (white for PDF)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x, y, boxSize, boxSize);
                
                // Draw box border (black for PDF)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, boxSize, boxSize);
                
                // Draw zone numbers (black for PDF)
                ctx.fillStyle = '#000000';
                ctx.font = '12px Arial';
                ctx.textAlign = 'left';
                const zoneNum = row * 3 + col + 1;
                ctx.fillText(zoneNum.toString(), x + 5, y + 15);
            }
        }
        
        // Plot pitches
        this.pitchHistory.forEach(pitch => {
            const glovePos = this.convertToCanvasPosition(pitch.catcherGlove, padding, zoneSize);
            const ballPos = this.convertToCanvasPosition(pitch.ballLocation, padding, zoneSize);
            
            // Draw catcher target (brown square) - bigger
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(glovePos.x - 6, glovePos.y - 6, 12, 12);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            ctx.strokeRect(glovePos.x - 6, glovePos.y - 6, 12, 12);
            
            // Draw pitch location (colored circle) - bigger
            ctx.fillStyle = pitch.pitchColor;
            ctx.beginPath();
            ctx.arc(ballPos.x, ballPos.y, 7, 0, 2 * Math.PI);
            ctx.fill();
            
            // Use white border for dark colors (like black Cutter) for visibility
            if (pitch.pitchColor === 'black') {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
            }
            ctx.stroke();
            
            // Draw connection line matching pitch type color (black for Cutter in PDF)
            ctx.strokeStyle = pitch.pitchColor === 'black' ? '#000000' : pitch.pitchColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(glovePos.x, glovePos.y);
            ctx.lineTo(ballPos.x, ballPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
    
    convertToCanvasPosition(pitchPosition, padding, zoneSize) {
        // Convert zone to grid position
        const zoneRow = Math.floor((pitchPosition.zone - 1) / 3);
        const zoneCol = (pitchPosition.zone - 1) % 3;
        
        // Calculate position within the canvas with padding and gaps
        const boxSize = (zoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        // Convert relative position within zone (0-100px) to canvas coordinates
        const relativeX = pitchPosition.x / 100; // Convert to 0-1 range
        const relativeY = pitchPosition.y / 100; // Convert to 0-1 range
        
        const canvasX = padding + zoneCol * (boxSize + gap) + relativeX * boxSize;
        const canvasY = padding + zoneRow * (boxSize + gap) + relativeY * boxSize;
        
        return { x: canvasX, y: canvasY };
    }
    
    updatePlotLegend() {
        const legendContainer = document.getElementById('pitch-legend');
        legendContainer.innerHTML = '';
        
        // Get unique pitch types from history
        const uniquePitchTypes = [...new Set(this.pitchHistory.map(p => p.pitchType))];
        
        uniquePitchTypes.forEach(pitchType => {
            const pitch = this.pitchHistory.find(p => p.pitchType === pitchType);
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            legendItem.innerHTML = `
                <div class="legend-circle" style="background-color: ${pitch.pitchColor};"></div>
                <span>${pitch.pitchTypeName}</span>
            `;
            
            legendContainer.appendChild(legendItem);
        });
    }
    
    updateOverallCommandScore() {
        const scoreValueElement = this.overallScoreElement.querySelector('.score-value');
        const scoreGradeElement = this.overallScoreElement.querySelector('.score-grade');
        
        if (this.pitchHistory.length === 0) {
            scoreValueElement.textContent = '--';
            scoreGradeElement.textContent = 'No pitches yet';
            scoreGradeElement.className = 'score-grade';
            return;
        }
        
        // Calculate overall average distance
        const totalDistance = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            return sum + safeDistance;
        }, 0);
        
        const avgDistance = totalDistance / this.pitchHistory.length;
        const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
        const overallGrade = this.getDistanceScore(safeAvgDistance);
        
        scoreValueElement.textContent = `${safeAvgDistance.toFixed(1)}"`;
        scoreGradeElement.textContent = overallGrade.grade;
        scoreGradeElement.className = `score-grade ${overallGrade.class}`;
        
        // Apply color styling
        this.applyGradeColor(scoreGradeElement, overallGrade.class);
    }
    
    updateCommandBreakdown() {
        if (this.pitchHistory.length === 0) {
            this.breakdownTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No pitches recorded yet</td></tr>';
            return;
        }
        
        // Group pitches by type
        const pitchGroups = {};
        this.pitchHistory.forEach(pitch => {
            if (!pitchGroups[pitch.pitchType]) {
                pitchGroups[pitch.pitchType] = {
                    pitches: [],
                    name: pitch.pitchTypeName,
                    color: pitch.pitchColor
                };
            }
            pitchGroups[pitch.pitchType].pitches.push(pitch);
        });
        
        // Build table rows
        let tableHTML = '';
        Object.keys(pitchGroups).forEach(pitchType => {
            const group = pitchGroups[pitchType];
            const distances = group.pitches.map(pitch => {
                const pixelDistance = this.calculateHistoricalDistance(pitch);
                const inchDistance = pixelDistance / this.pixelsPerInch;
                return isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            });
            
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const bestDistance = Math.min(...distances);
            const worstDistance = Math.max(...distances);
            
            // Handle NaN in final calculations
            const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
            const safeBestDistance = isNaN(bestDistance) || !isFinite(bestDistance) ? 0 : bestDistance;
            const safeWorstDistance = isNaN(worstDistance) || !isFinite(worstDistance) ? 0 : worstDistance;
            
            const grade = this.getDistanceScore(safeAvgDistance);
            
            // Calculate most common zones for catcher and pitch locations
            const catcherZones = {};
            const pitchZones = {};
            
            group.pitches.forEach(pitch => {
                const catcherZone = pitch.catcherGlove.zone;
                const pitchZone = pitch.ballLocation.zone;
                
                catcherZones[catcherZone] = (catcherZones[catcherZone] || 0) + 1;
                pitchZones[pitchZone] = (pitchZones[pitchZone] || 0) + 1;
            });
            
            // Find most common zones
            const mostCommonCatcherZone = Object.keys(catcherZones).reduce((a, b) => 
                catcherZones[a] > catcherZones[b] ? a : b
            );
            const mostCommonPitchZone = Object.keys(pitchZones).reduce((a, b) => 
                pitchZones[a] > pitchZones[b] ? a : b
            );
            
            tableHTML += `
                <tr>
                    <td class="pitch-type-cell">
                        <div class="pitch-type-color" style="background-color: ${group.color};"></div>
                        ${group.name}
                    </td>
                    <td>${group.pitches.length}</td>
                    <td>${safeAvgDistance.toFixed(1)}"</td>
                    <td class="command-grade-cell ${grade.class}">${grade.grade}</td>
                    <td>${safeBestDistance.toFixed(1)}"</td>
                    <td>${safeWorstDistance.toFixed(1)}"</td>
                </tr>
            `;
        });
        
        this.breakdownTableBody.innerHTML = tableHTML;
        
        // Apply color styling to grade cells
        this.breakdownTableBody.querySelectorAll('.command-grade-cell').forEach(cell => {
            const gradeClass = Array.from(cell.classList).find(cls => 
                ['excellent', 'good', 'average', 'fair', 'poor'].includes(cls)
            );
            if (gradeClass) {
                this.applyGradeColor(cell, gradeClass);
            }
        });
    }
    
    applyGradeColor(element, gradeClass) {
        const colors = {
            'excellent': '#00ff00',
            'good': '#0066ff',
            'average': '#ffff00',
            'fair': '#ff8800',
            'poor': '#ff0000'
        };
        
        if (colors[gradeClass]) {
            element.style.color = colors[gradeClass];
            element.style.borderColor = colors[gradeClass];
        }
    }
    
    exportCSV() {
        if (this.pitchHistory.length === 0) {
            alert('No pitches to export. Chart some pitches first!');
            return;
        }
        
        // Ask user if they want to append to existing file or create new one
        const appendChoice = confirm(
            'Do you want to APPEND to the overall command database?\n\n' +
            'Click OK to append to "Overall_Command_Database.csv"\n' +
            'Click Cancel to create a new dated file'
        );
        
        const pitcherName = this.pitcherNameInput.value.trim() || 'Unknown Pitcher';
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();
        
        // Create CSV headers
        const headers = [
            'Date',
            'Time',
            'Pitcher Name',
            'Session Pitch #',
            'Pitch Type',
            'Catcher Target Zone',
            'Ball Location Zone',
            'Distance (inches)',
            'Command Grade',
            'Catcher X',
            'Catcher Y',
            'Ball X',
            'Ball Y'
        ];
        
        // Create CSV rows
        const rows = this.pitchHistory.map(pitch => {
            const distancePixels = this.calculateHistoricalDistance(pitch);
            const distanceInches = distancePixels / this.pixelsPerInch;
            const safeDistance = isNaN(distanceInches) || !isFinite(distanceInches) ? 0 : distanceInches;
            const grade = this.getDistanceScore(safeDistance);
            
            return [
                currentDate,
                currentTime,
                pitcherName,
                pitch.number,
                pitch.pitchTypeName,
                pitch.catcherGlove.zone,
                pitch.ballLocation.zone,
                safeDistance.toFixed(1),
                grade.grade,
                pitch.catcherGlove.x.toFixed(1),
                pitch.catcherGlove.y.toFixed(1),
                pitch.ballLocation.x.toFixed(1),
                pitch.ballLocation.y.toFixed(1)
            ];
        });
        
        let csvContent;
        let fileName;
        
        if (appendChoice) {
            // For appending: only include data rows (no headers)
            csvContent = rows
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
            fileName = 'Overall_Command_Database.csv';
            
            // Add instructions for user
            setTimeout(() => {
                alert(
                    'IMPORTANT: To append to existing file:\n\n' +
                    '1. If "Overall_Command_Database.csv" already exists, open it\n' +
                    '2. Copy the downloaded data\n' +
                    '3. Paste it at the bottom of your existing file\n' +
                    '4. Save the combined file\n\n' +
                    'This data is ready to append!'
                );
            }, 100);
        } else {
            // For new file: include headers and data
            csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
            const cleanName = pitcherName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            fileName = `${cleanName}_command_data_${new Date().toISOString().split('T')[0]}.csv`;
        }
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    exportReport() {
        if (this.pitchHistory.length === 0) {
            alert('No pitches to export. Chart some pitches first!');
            return;
        }
        
        // Create a new canvas for the combined report
        const reportCanvas = document.createElement('canvas');
        const ctx = reportCanvas.getContext('2d');
        
        // Set canvas size for landscape report (11" x 8.5" at 150 DPI)
        reportCanvas.width = 1650; // 11 * 150 (landscape)
        reportCanvas.height = 1275; // 8.5 * 150
        
        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, reportCanvas.width, reportCanvas.height);
        
        const pitcherName = this.pitcherNameInput.value.trim() || 'Unknown Pitcher';
        
        // Add title
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cressey Sports Command Training', reportCanvas.width / 2, 60);
        
        // Add pitcher name
        ctx.font = 'bold 24px Arial';
        ctx.fillText(pitcherName, reportCanvas.width / 2, 100);
        
        // Add date (without time)
        ctx.font = '20px Arial';
        ctx.fillText(new Date().toLocaleDateString(), reportCanvas.width / 2, 130);
        
        // Draw the pitch plot (left side) - bigger and right under title
        this.drawReportPlot(ctx, 50, 95, 500, 500);
        
        // Add overall stats (top center) - properly centered
        this.drawOverallStats(ctx, 625, 170);
        
        // Draw overall heatmap (top right) - same size as main plot
        this.drawHeatmap(ctx, 1100, 95, 'Overall Heatmap', this.pitchHistory);
        
        // Draw breakdown table (middle, centered) - properly sized
        this.drawBreakdownTable(ctx, 395, 600, 860); // Centered: (1650-860)/2 = 395
        
        // Calculate dynamic position for pitch type zones based on table size
        const numPitchTypes = Object.keys(this.pitchHistory.reduce((groups, pitch) => {
            groups[pitch.pitchType] = true;
            return groups;
        }, {})).length;
        const tableRows = numPitchTypes;
        const rowHeight = 40;
        const headerHeight = 50;
        const tableHeight = headerHeight + tableRows * rowHeight;
        const zoneStartY = 600 + tableHeight + 50; // Table start + table height + 50px gap
        
        // Draw individual pitch type strike zones (bottom, below table) - dynamic spacing
        this.drawPitchTypeZones(ctx, 50, zoneStartY);
        
        // Convert to image and download as PNG (for now)
        reportCanvas.toBlob((blob) => {
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            const fileName = pitcherName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.setAttribute('download', `${fileName}_command_report_${new Date().toISOString().split('T')[0]}.png`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
    
    
    drawReportPlot(ctx, x, y, width, height) {
        // Save context
        ctx.save();
        
        const padding = 60;
        const zoneSize = width - (padding * 2);
        const zoneStartX = x + padding;
        const zoneStartY = y + padding;
        
        // Draw white background for entire zone (PDF only)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw outer border around entire strike zone (black for PDF)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw inner strike zone (9-box area)
        const innerPadding = 60; // Space for outside pitches
        const innerZoneSize = zoneSize - (innerPadding * 2);
        const innerZoneX = zoneStartX + innerPadding;
        const innerZoneY = zoneStartY + innerPadding;
        
        // Draw inner zone background (white for PDF)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(innerZoneX, innerZoneY, innerZoneSize, innerZoneSize);
        
        // Draw zone boxes with gaps to match main page
        const boxSize = (innerZoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const boxX = innerZoneX + col * (boxSize + gap);
                const boxY = innerZoneY + row * (boxSize + gap);
                
                // Draw box background (white for PDF)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(boxX, boxY, boxSize, boxSize);
                
                // Draw box border (black for PDF)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(boxX, boxY, boxSize, boxSize);
                
                // Draw zone numbers (black for PDF)
                ctx.fillStyle = '#000000';
                ctx.font = '14px Arial';
                ctx.textAlign = 'left';
                const zoneNum = row * 3 + col + 1;
                ctx.fillText(zoneNum.toString(), boxX + 5, boxY + 18);
            }
        }
        
        // Plot pitches
        this.pitchHistory.forEach(pitch => {
            const glovePos = this.convertToReportPosition(pitch.catcherGlove, innerZoneX, innerZoneY, innerZoneSize);
            const ballPos = this.convertToReportPosition(pitch.ballLocation, innerZoneX, innerZoneY, innerZoneSize);
            
            // Draw connection line (black for Cutter in PDF)
            ctx.strokeStyle = pitch.pitchColor === 'black' ? '#000000' : pitch.pitchColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(glovePos.x, glovePos.y);
            ctx.lineTo(ballPos.x, ballPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw catcher target (brown square)
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(glovePos.x - 6, glovePos.y - 6, 12, 12);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            ctx.strokeRect(glovePos.x - 6, glovePos.y - 6, 12, 12);
            
            // Draw pitch location (colored circle)
            ctx.fillStyle = pitch.pitchColor;
            ctx.beginPath();
            ctx.arc(ballPos.x, ballPos.y, 7, 0, 2 * Math.PI);
            ctx.fill();
            
            // Use black border for non-Cutter pitches (no border for Cutter on white background)
            if (pitch.pitchColor !== 'black') {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
        
        // Add title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Pitch Command Plot', x + width / 2, y - 5);
        
        // Restore context
        ctx.restore();
    }
    
    convertToReportPosition(pitchPosition, startX, startY, zoneSize) {
        const zoneRow = Math.floor((pitchPosition.zone - 1) / 3);
        const zoneCol = (pitchPosition.zone - 1) % 3;
        
        // Calculate position with gaps to match main page
        const boxSize = (zoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        const relativeX = pitchPosition.x / 100;
        const relativeY = pitchPosition.y / 100;
        
        const canvasX = startX + zoneCol * (boxSize + gap) + relativeX * boxSize;
        const canvasY = startY + zoneRow * (boxSize + gap) + relativeY * boxSize;
        
        return { x: canvasX, y: canvasY };
    }
    
    drawOverallStats(ctx, x, y) {
        ctx.save();
        
        // Calculate overall stats
        const totalDistance = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            return sum + safeDistance;
        }, 0);
        
        const avgDistance = totalDistance / this.pitchHistory.length;
        const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
        const overallGrade = this.getDistanceScore(safeAvgDistance);
        
        // Draw stats box
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(x, y, 400, 200);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, 400, 200);
        
        // Add title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Overall Command Stats', x + 200, y + 35);
        
        // Add stats
        ctx.font = '20px Arial';
        ctx.fillText(`Total Pitches: ${this.pitchHistory.length}`, x + 200, y + 70);
        ctx.fillText(`Average Distance: ${safeAvgDistance.toFixed(1)}"`, x + 200, y + 100);
        ctx.fillText(`Overall Grade: ${overallGrade.grade}`, x + 200, y + 130);
        
        ctx.restore();
    }
    
    drawBreakdownTable(ctx, x, y, customWidth = 1000) {
        ctx.save();
        
        if (this.pitchHistory.length === 0) {
            ctx.restore();
            return;
        }
        
        // Group pitches by type
        const pitchGroups = {};
        this.pitchHistory.forEach(pitch => {
            if (!pitchGroups[pitch.pitchType]) {
                pitchGroups[pitch.pitchType] = {
                    pitches: [],
                    name: pitch.pitchTypeName,
                    color: pitch.pitchColor
                };
            }
            pitchGroups[pitch.pitchType].pitches.push(pitch);
        });
        
        // Table dimensions
        const tableWidth = 860; // Increased to accommodate wider zone columns
        const rowHeight = 40;
        const headerHeight = 50;
        // Adjusted column widths for 8 columns - zone columns need 100px each
        const colWidths = [140, 80, 120, 160, 80, 80, 100, 100]; // Zone columns now 100px
        
        // Draw table background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, tableWidth, headerHeight + Object.keys(pitchGroups).length * rowHeight);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tableWidth, headerHeight + Object.keys(pitchGroups).length * rowHeight);
        
        // Draw header
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(x, y, tableWidth, headerHeight);
        ctx.strokeRect(x, y, tableWidth, headerHeight);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        
        const headers = ['Pitch Type', 'Count', 'Avg Distance', 'Command Grade', 'Best', 'Worst', 'C Zone', 'P Zone'];
        let currentX = x;
        headers.forEach((header, i) => {
            ctx.fillText(header, currentX + colWidths[i] / 2, y + 30);
            currentX += colWidths[i];
        });
        
        // Draw rows
        let currentY = y + headerHeight;
        Object.keys(pitchGroups).forEach(pitchType => {
            const group = pitchGroups[pitchType];
            const distances = group.pitches.map(pitch => {
                const pixelDistance = this.calculateHistoricalDistance(pitch);
                const inchDistance = pixelDistance / this.pixelsPerInch;
                return isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            });
            
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const bestDistance = Math.min(...distances);
            const worstDistance = Math.max(...distances);
            
            const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
            const safeBestDistance = isNaN(bestDistance) || !isFinite(bestDistance) ? 0 : bestDistance;
            const safeWorstDistance = isNaN(worstDistance) || !isFinite(worstDistance) ? 0 : worstDistance;
            
            const grade = this.getDistanceScore(safeAvgDistance);
            
            // Calculate most common zones for catcher and pitch locations
            const catcherZones = {};
            const pitchZones = {};
            
            group.pitches.forEach(pitch => {
                const catcherZone = pitch.catcherGlove.zone;
                const pitchZone = pitch.ballLocation.zone;
                
                catcherZones[catcherZone] = (catcherZones[catcherZone] || 0) + 1;
                pitchZones[pitchZone] = (pitchZones[pitchZone] || 0) + 1;
            });
            
            // Find most common zones
            const mostCommonCatcherZone = Object.keys(catcherZones).reduce((a, b) => 
                catcherZones[a] > catcherZones[b] ? a : b
            );
            const mostCommonPitchZone = Object.keys(pitchZones).reduce((a, b) => 
                pitchZones[a] > pitchZones[b] ? a : b
            );
            
            // Draw row background
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(x, currentY, tableWidth, rowHeight);
            ctx.strokeRect(x, currentY, tableWidth, rowHeight);
            
            // Draw row data
            ctx.fillStyle = '#000';
            ctx.font = '16px Arial';
            
            const rowData = [
                group.name,
                group.pitches.length.toString(),
                `${safeAvgDistance.toFixed(1)}"`,
                grade.grade,
                `${safeBestDistance.toFixed(1)}"`,
                `${safeWorstDistance.toFixed(1)}"`,
                mostCommonCatcherZone,
                mostCommonPitchZone
            ];
            
            currentX = x;
            rowData.forEach((data, i) => {
                if (i === 0) {
                    // For pitch type column, draw colored dot + text (CENTERED)
                    const centerX = currentX + colWidths[i] / 2;
                    const dotX = centerX - 50; // Position dot to left of center
                    const dotY = currentY + 20;
                    
                    // Draw colored dot
                    ctx.fillStyle = group.color;
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, 6, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Draw pitch type name (centered)
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'center';
                    ctx.fillText(data, centerX, currentY + 25);
                } else {
                    // Regular text for other columns
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'center';
                    ctx.fillText(data, currentX + colWidths[i] / 2, currentY + 25);
                }
                currentX += colWidths[i];
            });
            
            currentY += rowHeight;
        });
        
        // Add table title (centered over table)
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Command Breakdown by Pitch Type', x + tableWidth / 2, y - 20);
        
        ctx.restore();
    }
    
    drawPitchTypeZones(ctx, x, y) {
        ctx.save();
        
        if (this.pitchHistory.length === 0) {
            ctx.restore();
            return;
        }
        
        // Group pitches by type
        const pitchGroups = {};
        this.pitchHistory.forEach(pitch => {
            if (!pitchGroups[pitch.pitchType]) {
                pitchGroups[pitch.pitchType] = {
                    pitches: [],
                    name: pitch.pitchTypeName,
                    color: pitch.pitchColor
                };
            }
            pitchGroups[pitch.pitchType].pitches.push(pitch);
        });
        
        const pitchTypes = Object.keys(pitchGroups);
        const numPitchTypes = pitchTypes.length;
        
        // Dynamic sizing based on number of pitch types
        let zoneSize, zonesPerRow, zoneSpacing;
        
        if (numPitchTypes <= 2) {
            zoneSize = 280;  // Large zones for 1-2 pitch types
            zonesPerRow = 2;
            zoneSpacing = 320;
        } else if (numPitchTypes <= 4) {
            zoneSize = 240;  // Medium zones for 3-4 pitch types
            zonesPerRow = 4;
            zoneSpacing = 280;
        } else if (numPitchTypes <= 6) {
            zoneSize = 200;  // Smaller zones for 5-6 pitch types
            zonesPerRow = 6;
            zoneSpacing = 240;
        } else {
            zoneSize = 160;  // Smallest zones for 7+ pitch types
            zonesPerRow = 8;
            zoneSpacing = 190;
        }
        
        const titleHeight = 30;
        const totalWidth = Math.min(numPitchTypes, zonesPerRow) * zoneSpacing;
        const canvasWidth = 1650; // PDF canvas width
        const startX = (canvasWidth - totalWidth) / 2; // Center horizontally
        
        pitchTypes.forEach((pitchType, index) => {
            const group = pitchGroups[pitchType];
            const row = Math.floor(index / zonesPerRow);
            const col = index % zonesPerRow;
            
            // For partial rows, center them
            const zonesInThisRow = Math.min(zonesPerRow, numPitchTypes - row * zonesPerRow);
            const rowStartX = startX + (totalWidth - zonesInThisRow * zoneSpacing) / 2;
            
            const zoneX = rowStartX + col * zoneSpacing;
            const zoneY = y + row * (zoneSize + titleHeight + 20);
            
            // Draw title
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(group.name, zoneX + zoneSize / 2, zoneY - 10);
            
            // Draw white background for entire zone
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(zoneX, zoneY, zoneSize, zoneSize);
            
            // Draw outer border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(zoneX, zoneY, zoneSize, zoneSize);
            
            // Draw inner strike zone (9-box area) - dynamic padding based on zone size
            const padding = Math.max(20, zoneSize * 0.15); // Proportional padding
            const innerZoneSize = zoneSize - (padding * 2);
            const innerZoneX = zoneX + padding;
            const innerZoneY = zoneY + padding;
            
            // Draw inner zone background (also white)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(innerZoneX, innerZoneY, innerZoneSize, innerZoneSize);
            
            // Draw zone boxes
            const boxSize = (innerZoneSize - 4) / 3;
            const gap = 2;
            
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const boxX = innerZoneX + col * (boxSize + gap);
                    const boxY = innerZoneY + row * (boxSize + gap);
                    
                    // Draw box background (white)
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(boxX, boxY, boxSize, boxSize);
                    
                    // Draw box border (black)
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(boxX, boxY, boxSize, boxSize);
                    
                    // Draw zone number (black)
                    ctx.fillStyle = '#000000';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'left';
                    const zoneNum = row * 3 + col + 1;
                    ctx.fillText(zoneNum.toString(), boxX + 3, boxY + 12);
                }
            }
            
            // Plot pitches for this type only
            group.pitches.forEach(pitch => {
                const glovePos = this.convertToMiniZonePosition(pitch.catcherGlove, zoneX, zoneY, zoneSize);
                const ballPos = this.convertToMiniZonePosition(pitch.ballLocation, zoneX, zoneY, zoneSize);
                
                // Draw connection line (black for Cutter in PDF)
                ctx.strokeStyle = group.color === 'black' ? '#000000' : group.color;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(glovePos.x, glovePos.y);
                ctx.lineTo(ballPos.x, ballPos.y);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Draw catcher target (brown square) - bigger for PDF
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(glovePos.x - 4, glovePos.y - 4, 8, 8);
                
                // Draw pitch location (colored circle) - bigger for PDF
                ctx.fillStyle = group.color;
                ctx.beginPath();
                ctx.arc(ballPos.x, ballPos.y, 6, 0, 2 * Math.PI);
                ctx.fill();
                
                // White border for black pitches
                if (group.color === 'black') {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        });
        
        ctx.restore();
    }
    
    convertToMiniZonePosition(pitchPosition, zoneX, zoneY, zoneSize) {
        const zoneRow = Math.floor((pitchPosition.zone - 1) / 3);
        const zoneCol = (pitchPosition.zone - 1) % 3;
        
        const padding = Math.max(20, zoneSize * 0.15); // Match the dynamic padding
        const innerZoneSize = zoneSize - (padding * 2);
        const boxSize = (innerZoneSize - 4) / 3;
        const gap = 2;
        
        const relativeX = pitchPosition.x / 100;
        const relativeY = pitchPosition.y / 100;
        
        const canvasX = zoneX + padding + zoneCol * (boxSize + gap) + relativeX * boxSize;
        const canvasY = zoneY + padding + zoneRow * (boxSize + gap) + relativeY * boxSize;
        
        return { x: canvasX, y: canvasY };
    }
    
    drawHeatmap(ctx, x, y, title, pitches) {
        ctx.save();
        
        if (pitches.length === 0) {
            ctx.restore();
            return;
        }
        
        const heatmapSize = 500; // Same size as main plot
        
        // Draw title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + heatmapSize / 2, y - 5);
        
        // Draw background structure to match Pitch Command Plot
        const padding = 60;
        const zoneSize = heatmapSize - (padding * 2);
        const zoneStartX = x + padding;
        const zoneStartY = y + padding;
        
        // Draw white background for entire zone (PDF only)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw outer border around entire strike zone (black for PDF)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw inner strike zone (9-box area)
        const innerPadding = 60;
        const innerZoneSize = zoneSize - (innerPadding * 2);
        const innerZoneX = zoneStartX + innerPadding;
        const innerZoneY = zoneStartY + innerPadding;
        
        // Draw inner zone background (white for PDF)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(innerZoneX, innerZoneY, innerZoneSize, innerZoneSize);
        
        // Create density grid (100x100 for smoother heatmap)
        const gridSize = 100;
        const densityGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
        
        // Convert pitch positions to heatmap coordinates and create density blobs
        pitches.forEach(pitch => {
            const ballPos = this.convertToHeatmapCoords(pitch.ballLocation, gridSize);
            
            // Create larger density blobs with stronger Gaussian effect
            const radius = 12; // Larger radius for smoother blobs
            const intensity = 1;
            const sigma = 4; // Wider spread for smoother gradients
            
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const gridX = Math.floor(ballPos.x) + dx;
                    const gridY = Math.floor(ballPos.y) + dy;
                    
                    if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const weight = Math.exp(-distance * distance / (2 * sigma * sigma)) * intensity;
                        densityGrid[gridY][gridX] += weight;
                    }
                }
            }
        });
        
        // Find max density for normalization
        let maxDensity = 0;
        for (let row of densityGrid) {
            for (let cell of row) {
                maxDensity = Math.max(maxDensity, cell);
            }
        }
        
        // Draw heatmap with smooth blobs in inner zone area
        const cellSize = innerZoneSize / gridSize;
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const density = densityGrid[row][col];
                if (density > 0.02) { // Show even lower-level density for smoother gradients
                    const intensity = Math.min(density / maxDensity, 1);
                    const color = this.getHeatmapColor(intensity);
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        innerZoneX + col * cellSize,
                        innerZoneY + row * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        
        // Draw zone boxes with gaps to match main page EXACTLY
        const boxSize = (innerZoneSize - 4) / 3;
        const gap = 2;
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const boxX = innerZoneX + col * (boxSize + gap);
                const boxY = innerZoneY + row * (boxSize + gap);
                
                // Don't draw box background - let heatmap show through
                
                // Draw box border (black for PDF)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(boxX, boxY, boxSize, boxSize);
                
                // Draw zone numbers (black for PDF)
                ctx.fillStyle = '#000000';
                ctx.font = '14px Arial';
                ctx.textAlign = 'left';
                const zoneNum = row * 3 + col + 1;
                ctx.fillText(zoneNum.toString(), boxX + 5, boxY + 18);
            }
        }
        
        ctx.restore();
    }
    
    convertToHeatmapCoords(ballLocation, gridSize) {
        // Convert from our zone system to heatmap grid coordinates
        const zoneRow = Math.floor((ballLocation.zone - 1) / 3);
        const zoneCol = (ballLocation.zone - 1) % 3;
        
        // Map to heatmap coordinates
        const padding = gridSize * 0.2; // 20% padding
        const innerSize = gridSize - (padding * 2);
        const zoneSize = innerSize / 3;
        
        const relativeX = ballLocation.x / 100;
        const relativeY = ballLocation.y / 100;
        
        const gridX = padding + zoneCol * zoneSize + relativeX * zoneSize;
        const gridY = padding + zoneRow * zoneSize + relativeY * zoneSize;
        
        return { x: gridX, y: gridY };
    }
    
    getHeatmapColor(intensity) {
        // Create blue to red gradient
        const colors = [
            { r: 68, g: 120, b: 181 },   // Blue
            { r: 116, g: 173, b: 209 },  // Light blue
            { r: 255, g: 255, b: 255 },  // White
            { r: 253, g: 174, b: 97 },   // Light orange
            { r: 215, g: 48, b: 39 }     // Red
        ];
        
        const scaledIntensity = intensity * (colors.length - 1);
        const index = Math.floor(scaledIntensity);
        const fraction = scaledIntensity - index;
        
        if (index >= colors.length - 1) {
            const color = colors[colors.length - 1];
            return `rgb(${color.r}, ${color.g}, ${color.b})`;
        }
        
        const color1 = colors[index];
        const color2 = colors[index + 1];
        
        const r = Math.round(color1.r + (color2.r - color1.r) * fraction);
        const g = Math.round(color1.g + (color2.g - color1.g) * fraction);
        const b = Math.round(color1.b + (color2.b - color1.b) * fraction);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BaseballChartingApp();
});
