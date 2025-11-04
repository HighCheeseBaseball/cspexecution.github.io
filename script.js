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
        this.selectedHandedness = 'RHP'; // Default to Right-Handed Pitcher
        
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
        this.handednessButtons = document.querySelectorAll('.handedness-btn');
        
        this.setupEventListeners();
        this.initializeHandedness();
        this.updatePitchTypeButtonText();
        this.updateStatus();
        this.updateTableHeaders();
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
        
        // Handedness buttons
        this.handednessButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectHandedness(e));
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
        
        const score = this.getDistanceScore(distanceInches, this.selectedPitchType, this.selectedHandedness, this.currentPitch.catcherGlove.zone, this.currentPitch.ballLocation.zone, this.currentPitch.ballLocation.y);
        
        // Add to pitch history
        this.pitchCounter++;
        const pitchData = {
            number: this.pitchCounter,
            pitchType: this.selectedPitchType,
            pitchTypeName: this.getPitchTypeName(this.selectedPitchType),
            pitchColor: this.selectedPitchColor,
            handedness: this.selectedHandedness,
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
        
        // Show completion message with 1-10 score and color-coded text
        this.statusElement.textContent = `Pitch #${this.pitchCounter} - Score: ${score.score}/10 - ${score.grade} | Ready for next pitch...`;
        
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
    
    selectHandedness(event) {
        // Remove active class from all handedness buttons
        this.handednessButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        event.target.classList.add('active');
        
        // Update selected handedness
        this.selectedHandedness = event.target.dataset.hand;
    }
    
    initializeHandedness() {
        // Set RHP as default active button
        this.handednessButtons.forEach(btn => {
            if (btn.dataset.hand === 'RHP') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    updatePitchTypeButtonText() {
        // Update pitch type button text based on data-pitch attribute
        this.pitchTypeButtons.forEach(btn => {
            const pitchCode = btn.dataset.pitch;
            if (pitchCode) {
                const pitchName = this.getPitchTypeName(pitchCode);
                btn.textContent = pitchName;
            }
        });
    }
    
    getPitchTypeName(code) {
        const pitchTypes = {
            'FS': 'Four-Seam',
            'CH': 'Change',
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
            this.distanceScoreElement.textContent = `Distance: 0.0" - Excellent`;
            this.distanceScoreElement.className = `distance-score excellent`;
            this.distanceScoreElement.style.display = 'block';
            return;
        }
        
        const score = this.getDistanceScore(distanceInches, this.selectedPitchType, this.selectedHandedness, this.currentPitch.catcherGlove.zone, this.currentPitch.ballLocation.zone, this.currentPitch.ballLocation.y);
        
        this.distanceScoreElement.textContent = `Score: ${score.score}/10 - ${score.grade} (${distanceInches.toFixed(1)}") - ${score.reasoning}`;
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
    
    getDistanceScore(distanceInches, pitchType, handedness, catcherZone, ballZone, ballY = null) {
        // Base distance score (1-10 scale)
        let baseScore = this.getBaseDistanceScore(distanceInches);
        
        // Get zone analysis
        const zoneAnalysis = this.analyzeZonePlacement(catcherZone, ballZone, ballY);
        
        // Get directional bonus/penalty based on pitch type and handedness
        const directionalAdjustment = this.getDirectionalAdjustment(pitchType, handedness, zoneAnalysis);
        
        // Apply zone 5 penalty
        const zone5Penalty = this.getZone5Penalty(ballZone);
        
        // Calculate final score
        let finalScore = baseScore + directionalAdjustment - zone5Penalty;
        finalScore = Math.max(1, Math.min(10, Math.round(finalScore))); // Clamp between 1-10
        
        // Get grade and class
        const grade = this.getScoreGrade(finalScore);
        const classType = this.getScoreClass(finalScore);
        
        return {
            score: finalScore,
            grade: grade,
            class: classType,
            distance: distanceInches,
            baseScore: baseScore,
            directionalBonus: directionalAdjustment,
            zone5Penalty: zone5Penalty,
            reasoning: this.getScoringReasoning(pitchType, handedness, zoneAnalysis, directionalAdjustment, zone5Penalty)
        };
    }
    
    getBaseDistanceScore(distanceInches) {
        // Steeper distance-based scoring: reward precision more, penalize misses more harshly
        if (distanceInches <= 1.0) return 10;  // Perfect command
        if (distanceInches <= 2.0) return 9;  // Excellent
        if (distanceInches <= 3.0) return 8;  // Very Good
        if (distanceInches <= 4.0) return 7;  // Good
        if (distanceInches <= 6.0) return 6;  // Above Average
        if (distanceInches <= 8.0) return 5;  // Average
        if (distanceInches <= 10.0) return 4; // Below Average
        if (distanceInches <= 12.0) return 3; // Poor
        if (distanceInches <= 15.0) return 2; // Very Poor
        return 1; // Terrible
    }
    
    analyzeZonePlacement(catcherZone, ballZone, ballY = null) {
        // Zone classifications
        const topZones = [1, 2, 3];
        const middleZones = [4, 5, 6];
        const bottomZones = [7, 8, 9];
        const leftZones = [1, 4, 7];
        const centerZones = [2, 5, 8];
        const rightZones = [3, 6, 9];
        
        // For middle zones, check if ball is in upper half of the zone
        let isUpperHalfOfMiddle = false;
        if (middleZones.includes(ballZone) && ballY !== null) {
            // If ball is in middle zone and we have Y position, check if it's in upper half
            // ballY is relative position within the zone (0-100), upper half would be 0-50
            isUpperHalfOfMiddle = ballY <= 50;
        }
        
        return {
            isTop: topZones.includes(ballZone),
            isMiddle: middleZones.includes(ballZone),
            isBottom: bottomZones.includes(ballZone),
            isLeft: leftZones.includes(ballZone),
            isCenter: centerZones.includes(ballZone),
            isRight: rightZones.includes(ballZone),
            isZone5: ballZone === 5,
            isZone4: ballZone === 4,
            isZone6: ballZone === 6,
            isUpperHalf: topZones.includes(ballZone) || isUpperHalfOfMiddle, // Top row OR upper half of middle row
            isLowerHalf: bottomZones.includes(ballZone) || (middleZones.includes(ballZone) && ballY !== null && ballY > 50) // Bottom row OR lower half of middle row
        };
    }
    
    getDirectionalAdjustment(pitchType, handedness, zoneAnalysis) {
        if (handedness === 'LHP') {
            return this.getLHPAdjustment(pitchType, zoneAnalysis);
        } else {
            return this.getRHPAdjustment(pitchType, zoneAnalysis);
        }
    }
    
    getLHPAdjustment(pitchType, zoneAnalysis) {
        let adjustment = 0;
        
        // Reduced directional bonuses - still recognize good misses but penalize misses more
        switch (pitchType) {
            case 'FS': // Four-Seam: minimal reward for up misses
                if (zoneAnalysis.isTop) adjustment += 0.5;
                break;
                
            case 'SI': // Sinker: minimal reward for down/inside misses
                if (zoneAnalysis.isBottom && zoneAnalysis.isLeft) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isLeft) adjustment += 0.25;
                break;
                
            case 'CT': // Cutter: minimal reward for right side misses
                if (zoneAnalysis.isRight) adjustment += 0.5;
                break;
                
            case 'SL': // Slider: minimal reward for down/right, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isRight) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isRight) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3, 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'SW': // Sweeper: minimal reward for right/down misses
                if (zoneAnalysis.isRight && zoneAnalysis.isBottom) adjustment += 0.5;
                else if (zoneAnalysis.isRight || zoneAnalysis.isBottom) adjustment += 0.25;
                break;
                
            case 'CB': // Curveball: minimal reward for down/right, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isRight) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isRight) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'CH': // ChangeUp: minimal reward for down/left, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isLeft) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isLeft) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'SP': // Splitter: minimal reward for down/left, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isLeft) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isLeft) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
        }
        
        return adjustment;
    }
    
    getRHPAdjustment(pitchType, zoneAnalysis) {
        let adjustment = 0;
        
        // Reduced directional bonuses - still recognize good misses but penalize misses more
        switch (pitchType) {
            case 'FS': // Four-Seam: minimal reward for up misses
                if (zoneAnalysis.isTop) adjustment += 0.5;
                break;
                
            case 'SI': // Sinker: minimal reward for down/inside misses
                if (zoneAnalysis.isBottom && zoneAnalysis.isRight) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isRight) adjustment += 0.25;
                break;
                
            case 'CT': // Cutter: minimal reward for left side misses
                if (zoneAnalysis.isLeft) adjustment += 0.5;
                break;
                
            case 'SL': // Slider: minimal reward for down/left, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isLeft) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isLeft) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'SW': // Sweeper: minimal reward for left/down misses
                if (zoneAnalysis.isLeft && zoneAnalysis.isBottom) adjustment += 0.5;
                else if (zoneAnalysis.isLeft || zoneAnalysis.isBottom) adjustment += 0.25;
                break;
                
            case 'CB': // Curveball: minimal reward for down/left, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isLeft) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isLeft) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'CH': // ChangeUp: minimal reward for down/right, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isRight) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isRight) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
                
            case 'SP': // Splitter: minimal reward for down/right, penalty for upper half
                if (zoneAnalysis.isBottom && zoneAnalysis.isRight) adjustment += 0.5;
                else if (zoneAnalysis.isBottom || zoneAnalysis.isRight) adjustment += 0.25;
                // Penalty for upper half (zones 1, 2, 3 OR upper half of zones 4, 5, 6)
                if (zoneAnalysis.isUpperHalf) adjustment -= 1.0;
                break;
        }
        
        return adjustment;
    }
    
    getZone5Penalty(ballZone) {
        return ballZone === 5 ? 2.0 : 0;
    }
    
    getScoreGrade(score) {
        if (score >= 8) return 'Excellent';
        if (score >= 6) return 'Very Good';
        if (score >= 5) return 'Average';
        if (score >= 3) return 'Fair';
        return 'Poor';
    }
    
    getScoreClass(score) {
        if (score >= 8) return 'excellent';
        if (score >= 6) return 'good';
        if (score >= 5) return 'average';
        if (score >= 3) return 'fair';
        return 'poor';
    }
    
    getScoringReasoning(pitchType, handedness, zoneAnalysis, directionalAdjustment, zone5Penalty) {
        let reasoning = [];
        
        if (zone5Penalty > 0) {
            reasoning.push('Zone 5 penalty');
        }
        
        if (directionalAdjustment > 0) {
            reasoning.push('Good directional miss');
        } else if (directionalAdjustment < 0) {
            reasoning.push('Poor directional miss');
        }
        
        // Add specific reasoning based on pitch type and zone
        if (handedness === 'LHP') {
            if (pitchType === 'SI' && zoneAnalysis.isBottom && zoneAnalysis.isLeft) {
                reasoning.push('Sinker inside to LHB');
            }
            if (pitchType === 'SL' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Slider in upper half');
            }
            if (pitchType === 'CB' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Curveball in upper half');
            }
            if (pitchType === 'CH' && zoneAnalysis.isUpperHalf) {
                reasoning.push('ChangeUp in upper half');
            }
            if (pitchType === 'SP' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Splitter in upper half');
            }
        } else if (handedness === 'RHP') {
            if (pitchType === 'SI' && zoneAnalysis.isBottom && zoneAnalysis.isRight) {
                reasoning.push('Sinker inside to RHB');
            }
            if (pitchType === 'SL' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Slider in upper half');
            }
            if (pitchType === 'CB' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Curveball in upper half');
            }
            if (pitchType === 'CH' && zoneAnalysis.isUpperHalf) {
                reasoning.push('ChangeUp in upper half');
            }
            if (pitchType === 'SP' && zoneAnalysis.isUpperHalf) {
                reasoning.push('Splitter in upper half');
            }
        }
        
        return reasoning.join(', ') || 'Standard scoring';
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
            const score = this.getDistanceScore(distanceInches, pitch.pitchType, pitch.handedness, pitch.catcherGlove.zone, pitch.ballLocation.zone, pitch.ballLocation.y);
            
            entry.innerHTML = `
                <div class="pitch-number">Pitch #${pitch.number} - ${pitch.pitchTypeName} - ${pitch.timestamp}</div>
                <div class="pitch-details">
                    <strong>Score:</strong> ${score.score}/10 - ${score.grade} (${distanceInches.toFixed(1)}")<br>
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
        
        // Calculate average of individual enhanced scores
        const totalScore = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            const score = this.getDistanceScore(safeDistance, pitch.pitchType, pitch.handedness, pitch.catcherGlove.zone, pitch.ballLocation.zone, pitch.ballLocation.y);
            return sum + score.score;
        }, 0);
        const avgScore = totalScore / this.pitchHistory.length;
        const safeAvgScore = isNaN(avgScore) || !isFinite(avgScore) ? 0 : avgScore;
        
        // Calculate average distance for display
        const totalDistance = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            return sum + safeDistance;
        }, 0);
        const avgDistance = totalDistance / this.pitchHistory.length;
        const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
        
        const overallGrade = {
            score: Math.round(safeAvgScore),
            grade: this.getScoreGrade(safeAvgScore),
            class: this.getScoreClass(safeAvgScore)
        };
        
        // Use the score from the distance-based grade (not average of individual scores)
        scoreValueElement.textContent = `${overallGrade.score}/10`;
        scoreGradeElement.textContent = `Avg: ${safeAvgDistance.toFixed(1)}"`;
        scoreGradeElement.className = `score-grade ${overallGrade.class}`;
        
        // Apply color styling to both score value and grade
        this.applyGradeColor(scoreValueElement, overallGrade.class);
        this.applyGradeColor(scoreGradeElement, overallGrade.class);
    }
    
    updateTableHeaders() {
        // Update table headers dynamically
        const tableHeader = document.querySelector('thead tr');
        if (tableHeader) {
            const headers = tableHeader.querySelectorAll('th');
            if (headers.length >= 5) {
                // Update header texts and center them
                if (headers[0]) {
                    headers[0].textContent = 'Pitch';
                    headers[0].style.textAlign = 'center';
                }
                if (headers[1]) {
                    headers[1].textContent = 'Count';
                    headers[1].style.textAlign = 'center';
                }
                if (headers[2]) {
                    headers[2].textContent = 'Avg Score';
                    headers[2].style.textAlign = 'center';
                }
                // Add Avg Miss header if it doesn't exist
                if (headers.length === 4) {
                    // Insert Avg Miss header after Avg Score
                    const avgMissHeader = document.createElement('th');
                    avgMissHeader.textContent = 'Avg Miss';
                    avgMissHeader.style.textAlign = 'center';
                    headers[2].after(avgMissHeader);
                } else if (headers[3]) {
                    headers[3].textContent = 'Avg Miss';
                    headers[3].style.textAlign = 'center';
                }
                if (headers[4]) {
                    headers[4].textContent = 'Grade';
                    headers[4].style.textAlign = 'center';
                }
                // Remove Freq C Zone and Freq P Loc. headers if they exist
                if (headers.length > 5) {
                    // Remove headers 5 and 6 (Freq C Zone and Freq P Loc.)
                    for (let i = headers.length - 1; i >= 5; i--) {
                        if (headers[i]) {
                            headers[i].remove();
                        }
                    }
                }
                
                // Ensure all headers are centered (re-query to include any newly added headers)
                const allHeaders = tableHeader.querySelectorAll('th');
                allHeaders.forEach(header => {
                    header.style.textAlign = 'center';
                });
            }
        }
    }
    
    updateCommandBreakdown() {
        if (this.pitchHistory.length === 0) {
            this.breakdownTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No pitches recorded yet</td></tr>';
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
            
            const scores = group.pitches.map(pitch => {
                const pixelDistance = this.calculateHistoricalDistance(pitch);
                const inchDistance = pixelDistance / this.pixelsPerInch;
                const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
                const score = this.getDistanceScore(safeDistance, pitch.pitchType, pitch.handedness, pitch.catcherGlove.zone, pitch.ballLocation.zone, pitch.ballLocation.y);
                return score.score;
            });
            
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const bestScore = Math.max(...scores);
            const worstScore = Math.min(...scores);
            const bestDistance = Math.min(...distances);
            const worstDistance = Math.max(...distances);
            
            // Handle NaN in final calculations
            const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
            const safeAvgScore = isNaN(avgScore) || !isFinite(avgScore) ? 0 : avgScore;
            const safeBestScore = isNaN(bestScore) || !isFinite(bestScore) ? 0 : bestScore;
            const safeWorstScore = isNaN(worstScore) || !isFinite(worstScore) ? 0 : worstScore;
            const safeBestDistance = isNaN(bestDistance) || !isFinite(bestDistance) ? 0 : bestDistance;
            const safeWorstDistance = isNaN(worstDistance) || !isFinite(worstDistance) ? 0 : worstDistance;
            
            const grade = {
                grade: this.getScoreGrade(safeAvgScore),
                class: this.getScoreClass(safeAvgScore)
            };
            
            tableHTML += `
                <tr>
                    <td class="pitch-type-cell">
                        <div class="pitch-type-color" style="background-color: ${group.color};"></div>
                        ${group.name}
                    </td>
                    <td>${group.pitches.length}</td>
                    <td>${safeAvgScore.toFixed(1)}/10</td>
                    <td>${safeAvgDistance.toFixed(1)}"</td>
                    <td class="command-grade-cell ${grade.class}">${grade.grade}</td>
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
            'Handedness',
            'Session Pitch #',
            'Pitch Type',
            'Catcher Target Zone',
            'Ball Location Zone',
            'Distance (inches)',
            'Score (1-10)',
            'Command Grade',
            'Base Score',
            'Directional Bonus',
            'Zone 5 Penalty',
            'Scoring Reasoning',
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
            const grade = this.getDistanceScore(safeDistance, pitch.pitchType, pitch.handedness, pitch.catcherGlove.zone, pitch.ballLocation.zone, pitch.ballLocation.y);
            
            return [
                currentDate,
                currentTime,
                pitcherName,
                pitch.handedness,
                pitch.number,
                pitch.pitchTypeName,
                pitch.catcherGlove.zone,
                pitch.ballLocation.zone,
                safeDistance.toFixed(1),
                grade.score,
                grade.grade,
                grade.baseScore,
                grade.directionalBonus,
                grade.zone5Penalty,
                grade.reasoning,
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
        ctx.fillText('Cressey Sports Execution Trainer', reportCanvas.width / 2, 60);
        
        // Compute overall command score (match main page)
        const totalScoreForName = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            const score = this.getDistanceScore(
                safeDistance,
                pitch.pitchType,
                pitch.handedness,
                pitch.catcherGlove.zone,
                pitch.ballLocation.zone,
                pitch.ballLocation.y
            );
            return sum + score.score;
        }, 0);
        const avgScoreForName = this.pitchHistory.length > 0 ? (totalScoreForName / this.pitchHistory.length) : 0;
        const roundedAvgScore = Math.round(avgScoreForName);
        const gradeText = this.getScoreGrade(avgScoreForName);
        const classTypeForName = this.getScoreClass(avgScoreForName);
        const gradeColors = { excellent: '#00ff00', good: '#0066ff', average: '#ffff00', fair: '#ff8800', poor: '#ff0000' };
        const gradeColor = gradeColors[classTypeForName] || '#000000';
        
        // Top info row: Overall (left), Pitcher Name (center), Date (right)
        const rowY = 100;
        
        // Overall score (always black)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`Overall: ${roundedAvgScore}/10`, 50, rowY);
        
        // Pitcher name (black, centered)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(pitcherName, reportCanvas.width / 2, rowY);
        
        // Date (right-aligned, black)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(new Date().toLocaleDateString(), reportCanvas.width - 50, rowY);
        
        // Reset alignment to center for later titles
        ctx.textAlign = 'center';
        
        // Removed stats box; overall shown in top left
        
        // Draw pitch type heatmaps
        this.drawPitchTypeHeatmaps(ctx, 50, 150);
        
        // Calculate position for breakdown table based on heatmap layout
        const numPitchTypes = Object.keys(this.pitchHistory.reduce((groups, pitch) => {
            groups[pitch.pitchType] = true;
            return groups;
        }, {})).length;
        
        // Calculate how many pitch types fit per row horizontally (use fixed sizing here
        // to avoid scope issues with drawPitchTypeHeatmaps' internals)
        // Note: drawPitchTypeHeatmaps uses startX = 50, so we match that here
        const canvasWidth = 1650;
        const heatmapStartX = 50; // Match the startX used in drawPitchTypeHeatmaps call
        const availableWidth = canvasWidth - (heatmapStartX * 2);
        const HEATMAP_SIZE = 250;
        const TITLE_HEIGHT = 50;
        const PAIR_GAP = 2; // gap within a pitch type pair
        const SPACING_X = 20; // spacing between different pitch types
        const SPACING_Y = 10; // vertical spacing between rows
        const pairWidth = (HEATMAP_SIZE * 2) + PAIR_GAP + SPACING_X;
        const usableWidth = Math.max(0, availableWidth + SPACING_X);
        const pairsPerRow = Math.max(1, Math.floor(usableWidth / pairWidth));
        const numRows = Math.ceil(numPitchTypes / pairsPerRow);
        
        // Each heatmap + title for vertical height (fixed values)
        const heatmapHeight = HEATMAP_SIZE;
        const heatmapTitleHeight = TITLE_HEIGHT;
        const rowSpacing = numRows > 1 ? SPACING_Y : 0;
        const heatmapStartY = 150; // Starting Y position for heatmaps
        const totalHeatmapHeight = heatmapStartY + numRows * (heatmapHeight + heatmapTitleHeight + SPACING_Y);
        
        // Position table based on number of pitch types
        if (numPitchTypes === 4 || numPitchTypes === 5) {
            // For exactly 4 or 5 pitch types, position table to the right of heatmaps
            // Calculate where the last heatmap pair ends horizontally
            const lastCol = (numPitchTypes - 1) % pairsPerRow;
            const lastPairX = heatmapStartX + lastCol * pairWidth;
            const lastPairRightEdge = lastPairX + (HEATMAP_SIZE * 2) + PAIR_GAP;
            
            // Calculate Y position of the last row (align table with last row of heatmaps)
            const lastRow = Math.floor((numPitchTypes - 1) / pairsPerRow);
            const lastRowY = heatmapStartY + lastRow * (heatmapHeight + heatmapTitleHeight + SPACING_Y);
            
            // Position table to the right of the last heatmap with some spacing
            const tableX = lastPairRightEdge + 20; // 20px spacing from last heatmap
            const tableY = lastRowY; // Align with the last row of heatmaps
            
            // Check if table fits on the right side (with reduced right margin for 5 pitch types)
            const tableWidth = 550;
            const rightMargin = numPitchTypes === 5 ? 10 : 20; // Tighter margin for 5 pitch types
            if (tableX + tableWidth <= canvasWidth - rightMargin) {
                // Draw table to the right of heatmaps
                this.drawBreakdownTable(ctx, tableX, tableY, tableWidth);
            } else {
                // If it doesn't fit, try reducing spacing first
                const reducedSpacingX = lastPairRightEdge + 10; // Try 10px spacing instead
                if (reducedSpacingX + tableWidth <= canvasWidth - 10) {
                    // Draw table with reduced spacing
                    this.drawBreakdownTable(ctx, reducedSpacingX, tableY, tableWidth);
                } else {
                    // If it still doesn't fit, fall back to below
                    const tableStartY = totalHeatmapHeight + 50;
                    this.drawBreakdownTable(ctx, 550, tableStartY, tableWidth);
                }
            }
        } else {
            // For other numbers of pitch types, position table below heatmaps (centered)
            const tableStartY = totalHeatmapHeight + 50; // Start table below heatmaps with 50px gap
            this.drawBreakdownTable(ctx, 550, tableStartY, 550); // Centered: (1650-550)/2 = 550
        }
        
        // Helper to trigger download
        const triggerDownload = (href) => {
            try {
                const link = document.createElement('a');
                link.setAttribute('href', href);
                const fileName = pitcherName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                link.setAttribute('download', `${fileName}_command_report_${new Date().toISOString().split('T')[0]}.png`);
                link.style.display = 'none';
                document.body.appendChild(link);
                // Use setTimeout to ensure the link is in the DOM before clicking
                setTimeout(() => {
                    link.click();
                    // Remove link after a delay to ensure download starts
                    setTimeout(() => {
                        document.body.removeChild(link);
                    }, 100);
                }, 10);
            } catch (e) {
                console.error('Error triggering download:', e);
                alert('Error downloading PNG. Please try right-clicking the image and saving it manually.');
            }
        };

        // Convert to image and download as PNG (robust across browsers)
        try {
            if (reportCanvas.toBlob) {
                reportCanvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        triggerDownload(url);
                        // Don't revoke immediately - let download complete first
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    } else {
                        // Fallback if blob is null
                        const dataUrl = reportCanvas.toDataURL('image/png');
                        triggerDownload(dataUrl);
                    }
                }, 'image/png');
            } else {
                const dataUrl = reportCanvas.toDataURL('image/png');
                triggerDownload(dataUrl);
            }
        } catch (e) {
            console.error('Error generating PNG:', e);
            alert('Error generating PNG report. Please try again.');
            const dataUrl = reportCanvas.toDataURL('image/png');
            triggerDownload(dataUrl);
        }
    }
    
    
    drawPitchTypeHeatmaps(ctx, startX, startY) {
        if (this.pitchHistory.length === 0) {
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
        
        if (numPitchTypes === 0) {
            return;
        }
        
        // Fixed sizing and deterministic grid to eliminate overlap
        const heatmapSize = 250; // Strike zone square size
        const titleHeight = 50;  // Title row height used in spacing
        const typeSpacingX = 20; // Space between different pitch types (horizontal)
        const pairGap = 2;       // Space between catcher/pitch within the same type
        const typeSpacingY = 10; // Vertical space between rows

        // Compute how many pitch types fit per row based on canvas width
        const canvasWidth = ctx.canvas && ctx.canvas.width ? ctx.canvas.width : 1650;
        const pairWidth = heatmapSize * 2 + pairGap + typeSpacingX;
        const usableWidth = Math.max(0, canvasWidth - startX * 2 + typeSpacingX);
        const pairsPerRow = Math.max(1, Math.floor(usableWidth / pairWidth));

        pitchTypes.forEach((pitchType, index) => {
            const group = pitchGroups[pitchType];
            const col = index % pairsPerRow;
            const row = Math.floor(index / pairsPerRow);

            const pairX = startX + col * pairWidth;
            const pairY = startY + row * (heatmapSize + titleHeight + typeSpacingY);

            // Draw catcher target (left of pair)
            this.drawHeatmap(ctx, pairX, pairY, `${group.name} - Catcher Target`, group.pitches, 'catcher', heatmapSize, group.color);
            // Draw pitch location (right of pair)
            this.drawHeatmap(ctx, pairX + heatmapSize + pairGap, pairY, `${group.name} - Pitch Location`, group.pitches, 'ball', heatmapSize, group.color);
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
        
        // Calculate overall stats (match main page logic: average of enhanced per-pitch scores)
        const totalDistance = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            return sum + safeDistance;
        }, 0);
        
        const avgDistance = totalDistance / this.pitchHistory.length;
        const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
        
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
        
        // Calculate average score for display
        const totalScore = this.pitchHistory.reduce((sum, pitch) => {
            const pixelDistance = this.calculateHistoricalDistance(pitch);
            const inchDistance = pixelDistance / this.pixelsPerInch;
            const safeDistance = isNaN(inchDistance) || !isFinite(inchDistance) ? 0 : inchDistance;
            const score = this.getDistanceScore(
                safeDistance,
                pitch.pitchType,
                pitch.handedness,
                pitch.catcherGlove.zone,
                pitch.ballLocation.zone,
                pitch.ballLocation.y
            );
            return sum + score.score;
        }, 0);
        const avgScore = totalScore / this.pitchHistory.length;
        const safeAvgScore = isNaN(avgScore) || !isFinite(avgScore) ? 0 : avgScore;
        const overallGrade = { grade: this.getScoreGrade(safeAvgScore) };
        
        // Add stats
        ctx.font = '20px Arial';
        ctx.fillText(`Total Pitches: ${this.pitchHistory.length}`, x + 200, y + 70);
        ctx.fillText(`Average Score: ${safeAvgScore.toFixed(1)}/10`, x + 200, y + 100);
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
        
        // Table dimensions - tighter spacing to reduce dead space
        const tableWidth = 550; // Reduced width to eliminate dead space
        const rowHeight = 35;
        const headerHeight = 45;
        // Adjusted column widths for 5 columns - tighter fit
        const colWidths = [110, 55, 95, 95, 95]; // Updated for 5 columns with tighter spacing
        
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
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        
        // Calculate total column width and offset to center columns within table
        const totalColumnWidth = colWidths.reduce((sum, width) => sum + width, 0);
        const contentOffsetX = (tableWidth - totalColumnWidth) / 2;
        
        const headers = ['Pitch', 'Count', 'Avg Score', 'Avg Miss', 'Grade'];
        let currentX = x + contentOffsetX; // Apply offset to center columns
        headers.forEach((header, i) => {
            ctx.fillText(header, currentX + colWidths[i] / 2, y + 28);
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
            
            const scores = distances.map(distance => this.getDistanceScore(distance).score);
            const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const bestScore = Math.max(...scores);
            const worstScore = Math.min(...scores);
            const bestDistance = Math.min(...distances);
            const worstDistance = Math.max(...distances);
            
            const safeAvgDistance = isNaN(avgDistance) || !isFinite(avgDistance) ? 0 : avgDistance;
            const safeAvgScore = isNaN(avgScore) || !isFinite(avgScore) ? 0 : avgScore;
            const safeBestScore = isNaN(bestScore) || !isFinite(bestScore) ? 0 : bestScore;
            const safeWorstScore = isNaN(worstScore) || !isFinite(worstScore) ? 0 : worstScore;
            const safeBestDistance = isNaN(bestDistance) || !isFinite(bestDistance) ? 0 : bestDistance;
            const safeWorstDistance = isNaN(worstDistance) || !isFinite(worstDistance) ? 0 : worstDistance;
            
            const grade = {
                grade: this.getScoreGrade(safeAvgScore),
                class: this.getScoreClass(safeAvgScore)
            };
            
            // Draw row background
            ctx.fillStyle = '#f9f9f9';
            ctx.fillRect(x, currentY, tableWidth, rowHeight);
            ctx.strokeRect(x, currentY, tableWidth, rowHeight);
            
            // Draw row data
            ctx.fillStyle = '#000';
            ctx.font = '14px Arial';
            
            const rowData = [
                group.name,
                group.pitches.length.toString(),
                `${safeAvgScore.toFixed(1)}/10`,
                `${safeAvgDistance.toFixed(1)}"`,
                grade.grade
            ];
            
            // Grade colors for PNG
            const gradeColors = {
                'excellent': '#00ff00',  // Green
                'good': '#0066ff',       // Blue
                'average': '#b8860b',     // Dark Goldenrod (darker yellow for visibility)
                'fair': '#ff8800',       // Orange
                'poor': '#ff0000'        // Red
            };
            
            currentX = x + contentOffsetX; // Apply offset to center columns
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
                    ctx.fillText(data, centerX, currentY + 22);
                } else if (i === 4) {
                    // Grade column - color based on grade class and make it bold
                    const gradeColor = gradeColors[grade.class] || '#000000';
                    ctx.fillStyle = gradeColor;
                    ctx.textAlign = 'center';
                    ctx.font = 'bold 14px Arial'; // Bold font for grade
                    ctx.fillText(data, currentX + colWidths[i] / 2, currentY + 22);
                    ctx.font = '14px Arial'; // Restore regular font
                } else {
                    // Regular text for other columns
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'center';
                    ctx.fillText(data, currentX + colWidths[i] / 2, currentY + 22);
                }
                currentX += colWidths[i];
            });
            
            currentY += rowHeight;
        });
        
        // Add table title (centered over table)
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Command Breakdown by Pitch Type', x + tableWidth / 2, y - 15);
        
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
    
    drawHeatmap(ctx, x, y, title, pitches, locationType = 'ball', customSize = null, pitchColor = null) {
        ctx.save();
        
        if (pitches.length === 0) {
            ctx.restore();
            return;
        }
        
        const heatmapSize = customSize || 300; // Allow caller to control size
        
        // Draw title
        ctx.fillStyle = pitchColor || '#000';
        ctx.font = 'bold 14px Arial'; // Smaller font for compact layout
        ctx.textAlign = 'center';
        ctx.fillText(title, x + heatmapSize / 2, y - 3);
        
        // Draw background structure with more shadow zone for outside pitches
        const padding = 10; // Outer padding
        const zoneSize = heatmapSize - (padding * 2);
        const zoneStartX = x + padding;
        const zoneStartY = y + padding;
        
        // Draw white background for entire zone (PDF only)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw outer border around entire strike zone (black for PDF)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(zoneStartX, zoneStartY, zoneSize, zoneSize);
        
        // Draw inner strike zone (9-box area) - increased padding for shadow zone
        const innerPadding = 30; // Increased padding to show pitches outside the zone
        const innerZoneSize = zoneSize - (innerPadding * 2);
        const innerZoneX = zoneStartX + innerPadding;
        const innerZoneY = zoneStartY + innerPadding;
        
        // Draw inner zone background (white for PDF)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(innerZoneX, innerZoneY, innerZoneSize, innerZoneSize);
        
        // Convert pitch positions to canvas coordinates
        const positions = pitches.map(pitch => {
            const positionData = locationType === 'catcher' ? pitch.catcherGlove : pitch.ballLocation;
            return this.convertPositionToCanvas(positionData, innerZoneX, innerZoneY, innerZoneSize);
        });
        
        if (positions.length > 0) {
            // Calculate average position (center dot)
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
            const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
            
            // Calculate standard deviations for ellipse dimensions
            const varianceX = positions.reduce((sum, p) => sum + Math.pow(p.x - avgX, 2), 0) / positions.length;
            const varianceY = positions.reduce((sum, p) => sum + Math.pow(p.y - avgY, 2), 0) / positions.length;
            const stdDevX = Math.sqrt(varianceX);
            const stdDevY = Math.sqrt(varianceY);
            
            // Calculate ellipse dimensions (use 2 standard deviations for 95% coverage)
            const ellipseWidth = Math.max(stdDevX * 2, 10); // Minimum 10px width
            const ellipseHeight = Math.max(stdDevY * 2, 10); // Minimum 10px height
            
            // Use pitch color for ellipse, default to blue if not provided
            const ellipseColor = pitchColor || '#0066ff';
            
            // Draw translucent ellipse
            ctx.save();
            ctx.globalAlpha = 0.3; // Semi-transparent
            ctx.fillStyle = ellipseColor;
            ctx.beginPath();
            ctx.ellipse(avgX, avgY, ellipseWidth, ellipseHeight, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
            
            // Draw ellipse border
            ctx.strokeStyle = ellipseColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(avgX, avgY, ellipseWidth, ellipseHeight, 0, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw center dot (average position)
            ctx.fillStyle = ellipseColor;
            ctx.beginPath();
            ctx.arc(avgX, avgY, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw center dot border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Draw zone boxes with gaps to match main page EXACTLY
        const boxSize = (innerZoneSize - 4) / 3;
        const gap = 2;
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const boxX = innerZoneX + col * (boxSize + gap);
                const boxY = innerZoneY + row * (boxSize + gap);
                
                // Draw box border (black for PDF)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.strokeRect(boxX, boxY, boxSize, boxSize);
                
                // Draw zone numbers (black for PDF)
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px Arial'; // Smaller font for compact layout
                ctx.textAlign = 'left';
                const zoneNum = row * 3 + col + 1;
                ctx.fillText(zoneNum.toString(), boxX + 3, boxY + 12);
            }
        }
        
        ctx.restore();
    }
    
    convertPositionToCanvas(positionData, innerZoneX, innerZoneY, innerZoneSize) {
        // Handle invalid zones by defaulting to zone 5 (center)
        let zone = positionData.zone;
        if (isNaN(zone) || zone < 1 || zone > 9) {
            zone = 5; // Default to center zone for invalid zones
        }
        
        const zoneRow = Math.floor((zone - 1) / 3);
        const zoneCol = (zone - 1) % 3;
        
        // Calculate the actual position within the zone
        const boxSize = (innerZoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        // Convert relative position to actual pixel position within the zone
        // Allow values outside 0-100 for pitches outside the zone boundaries
        const relativeX = positionData.x / 100;
        const relativeY = positionData.y / 100;
        
        // Calculate the actual pixel position in the canvas
        const canvasX = innerZoneX + zoneCol * (boxSize + gap) + relativeX * boxSize;
        const canvasY = innerZoneY + zoneRow * (boxSize + gap) + relativeY * boxSize;
        
        return { x: canvasX, y: canvasY };
    }
    
    convertActualCoordsToHeatmap(ballLocation, innerZoneX, innerZoneY, innerZoneSize, gridSize, zoneStartX, zoneStartY, zoneSize) {
        // Convert actual x,y coordinates to heatmap grid coordinates
        // Handle invalid zones by defaulting to zone 5 (center)
        let zone = ballLocation.zone;
        if (isNaN(zone) || zone < 1 || zone > 9) {
            zone = 5; // Default to center zone for invalid zones
        }
        
        const zoneRow = Math.floor((zone - 1) / 3);
        const zoneCol = (zone - 1) % 3;
        
        // Calculate the actual position within the heatmap using the same logic as the main plot
        const boxSize = (innerZoneSize - 4) / 3; // Account for 2px gaps
        const gap = 2;
        
        // Convert relative position to actual pixel position within the zone
        // Allow values outside 0-100 for pitches outside the zone boundaries
        const relativeX = ballLocation.x / 100;
        const relativeY = ballLocation.y / 100;
        
        // Calculate the actual pixel position in the heatmap
        // Allow positions to extend beyond zone boundaries for outside pitches
        const actualX = innerZoneX + zoneCol * (boxSize + gap) + relativeX * boxSize;
        const actualY = innerZoneY + zoneRow * (boxSize + gap) + relativeY * boxSize;
        
        // Convert to heatmap grid coordinates (scale to full zone area, not just inner zone)
        // This allows pitches outside the inner zone to be visible in the shadow zone
        const gridX = (actualX - zoneStartX) / zoneSize * gridSize;
        const gridY = (actualY - zoneStartY) / zoneSize * gridSize;
        
        // Clamp to grid boundaries to prevent array out of bounds
        return { 
            x: Math.max(0, Math.min(gridSize - 1, gridX)), 
            y: Math.max(0, Math.min(gridSize - 1, gridY))
        };
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
