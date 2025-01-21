import {RoutingService} from "../../services/RoutingService.js";

const personalityModule = require('assistos').loadModule('personality', {});
const documentModule = require('assistos').loadModule('document', {});

export class BiasDetectorLanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.explainedDocuments = [];
        this.refreshDocuments = async () => {
            const documentsMetadata = await assistOS.space.getDocumentsMetadata(assistOS.space.id);

            // Filter bias analysis documents
            const biasDocuments = documentsMetadata.filter((doc) => doc.title.startsWith("bias_analysis_")) || [];

            // Filter bias explained documents
            const explainedDocuments = documentsMetadata.filter((doc) => doc.title.startsWith("bias_explained_")) || [];

            // Get complete documents with all metadata
            this.documents = await Promise.all(
                biasDocuments.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {}
                    };
                })
            );

            this.explainedDocuments = await Promise.all(
                explainedDocuments.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {}
                    };
                })
            );
        };
        this.invalidate(async () => {
            await this.refreshDocuments();
            this.boundsOnListUpdate = this.onListUpdate.bind(this);
        });
    }

    onListUpdate() {
        this.invalidate(this.refreshDocuments);
    }

    async beforeRender() {
        this.tableRows = "";
        this.explainedRows = "";

        // Generate rows for bias analysis documents
        this.documents.forEach((doc) => {
            let abstract = {};
            try {
                if (typeof doc.abstract === 'string') {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = doc.abstract;
                    let decodedAbstract = textarea.value;
                    decodedAbstract = decodedAbstract
                        .replace(/\n/g, '')
                        .replace(/\r/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    abstract = JSON.parse(decodedAbstract);
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                console.error('Error handling abstract:', error);
            }

            const timestamp = abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : 'N/A';
            const personality = abstract.personality || 'N/A';

            this.tableRows += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="viewAnalysis">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="personality">${personality}</span>
                            <span class="timestamp">${timestamp}</span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                        <button class="action-btn generate-btn" data-local-action="generateAction" data-id="${doc.id}" data-tooltip="Generate Document">
                            <svg fill="currentColor" width="800px" height="800px" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                            <g data-name="Magic Wand" id="Magic_Wand">
                            <path d="M10.89,57a3.89,3.89,0,0,0,2.76-1.14l26.7-26.7.26.78a3,3,0,0,0,1.07,1.45,3,3,0,0,0,4.13-.66l3-4.13,5.28-.05A2.86,2.86,0,0,0,55.82,26a2.93,2.93,0,0,0,.6-4.1l-3.09-4.15,1.66-5h0a3,3,0,0,0,0-1.83,2.9,2.9,0,0,0-1.46-1.69A3,3,0,0,0,51.31,9l-5,1.66L42.13,7.58A3,3,0,0,0,40.4,7h0a2.92,2.92,0,0,0-2.93,2.91l0,5.28-4.14,3a3,3,0,0,0,.79,5.2l.78.26L8.14,50.35A3.9,3.9,0,0,0,10.89,57ZM32.13,32.5a1,1,0,0,0-.63-.63L30,31.36,32.3,29l2,.67.67,2L32.64,34Zm2-11.49a1,1,0,0,1,0-.73.9.9,0,0,1,.34-.47L39,16.52a1,1,0,0,0,.41-.81l.05-5.79a.9.9,0,0,1,.28-.65A.91.91,0,0,1,40.38,9a.84.84,0,0,1,.55.19l4.58,3.39a1,1,0,0,0,.91.15l5.52-1.82a.91.91,0,0,1,1.15.58,1,1,0,0,1,0,.58l-1.82,5.51a1,1,0,0,0,.15.91l3.39,4.58a.94.94,0,0,1,.18.69,1,1,0,0,1-.37.61.9.9,0,0,1-.54.18l-5.79.05a1,1,0,0,0-.81.41l-3.29,4.55a1,1,0,0,1-1.33.21.9.9,0,0,1-.35-.47L40.7,23.93a1,1,0,0,0-.63-.63L34.7,21.49A.93.93,0,0,1,34.15,21ZM39,25l.68,2-3.09,3.09L36,28.59a1,1,0,0,0-.63-.62l-1.54-.52L37,24.36ZM9.56,51.77,28.39,32.94l2,.67.67,2L12.23,54.45a1.89,1.89,0,1,1-2.67-2.68Z"/>
                            <path d="M26,16.79c-.45-.79-1.38-.74-2.79-.66a9.44,9.44,0,0,1-5.68-1.52c-1.18-.77-2-1.28-2.75-.83s-.74,1.39-.66,2.79a9.39,9.39,0,0,1-1.52,5.69c-.77,1.18-1.28,1.95-.82,2.74s1.37.74,2.79.66a9.45,9.45,0,0,1,5.68,1.53c.93.6,1.88,1.32,2.75.82s.74-1.39.65-2.79a9.43,9.43,0,0,1,1.53-5.68C25.92,18.36,26.43,17.58,26,16.79Zm-2.49,1.65a11.43,11.43,0,0,0-1.85,6.9c0,.11,0,.24,0,.39l-.33-.22a11.5,11.5,0,0,0-6.26-1.86c-.21,0-.43,0-.64,0l-.39,0,.21-.33a11.47,11.47,0,0,0,1.85-6.9c0-.11,0-.25,0-.39l.33.21a11.47,11.47,0,0,0,6.9,1.85l.39,0Z"/>
                            <path d="M55.06,36.42c-.6-.6-1.36-.35-2.41,0a6.84,6.84,0,0,1-4.29,0c-1.06-.35-1.82-.6-2.42,0s-.34,1.35,0,2.41a6.84,6.84,0,0,1,0,4.29c-.35,1.05-.6,1.81,0,2.41a1.18,1.18,0,0,0,.89.36,5.32,5.32,0,0,0,1.53-.37,7,7,0,0,1,4.29,0c1.05.35,1.81.6,2.41,0s.34-1.36,0-2.41a6.84,6.84,0,0,1,0-4.29C55.4,37.77,55.65,37,55.06,36.42Zm-2,7.15a8.83,8.83,0,0,0-5.19,0,9,9,0,0,0,0-5.19,9,9,0,0,0,5.19,0A8.83,8.83,0,0,0,53.1,43.57Z"/>
                            <path d="M36.6,44.21a6.93,6.93,0,0,1-3.7-2.14c-.74-.83-1.27-1.43-2.08-1.21s-1,1-1.2,2.09a6.93,6.93,0,0,1-2.14,3.7c-.83.74-1.43,1.27-1.21,2.08s1,1,2.09,1.21a6.82,6.82,0,0,1,3.7,2.13c.64.72,1.24,1.44,2.09,1.21s1-1,1.2-2.09a6.85,6.85,0,0,1,2.13-3.7c.83-.74,1.43-1.27,1.21-2.08S37.69,44.43,36.6,44.21ZM33.43,50.6A8.88,8.88,0,0,0,29,48a9,9,0,0,0,2.59-4.48A8.85,8.85,0,0,0,36,46.12,8.92,8.92,0,0,0,33.43,50.6Z"/>
                            </g>
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        // Generate rows for explained documents
        this.explainedDocuments.forEach((doc) => {
            let abstract = {};
            try {
                if (typeof doc.abstract === 'string') {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = doc.abstract;
                    let decodedAbstract = textarea.value;
                    decodedAbstract = decodedAbstract
                        .replace(/\n/g, '')
                        .replace(/\r/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    abstract = JSON.parse(decodedAbstract);
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                console.error('Error handling abstract:', error);
                console.error('Raw abstract:', doc.abstract);
            }

            const timestamp = abstract && abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : new Date(doc.metadata.createdAt).toLocaleString();

            this.explainedRows += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="viewAnalysis">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="timestamp">${timestamp}</span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        if (assistOS.space.loadingDocuments) {
            assistOS.space.loadingDocuments.forEach((taskId) => {
                this.tableRows += `
                    <div data-id="${taskId}" class="analysis-card placeholder-analysis">
                        <div class="loading-icon small"></div>
                    </div>`;
            });
        }

        if (this.tableRows === "") {
            this.tableRows = `<div class="no-analyses">No analyses found</div>`;
        }

        if (this.explainedRows === "") {
            this.explainedRows = `<div class="no-analyses">No analyses found</div>`;
        }
    }

    async afterRender() {
        // Setup any event listeners or post-render operations
        const analysisItems = this.element.querySelectorAll('.analysis-card');
        analysisItems.forEach(item => {
            const content = item.querySelector('.analysis-content');
            if (content) {
                content.addEventListener('click', async () => {
                    // Get the parent card element which has the data-id
                    const card = content.closest('.analysis-card');
                    await this.editAction(card);
                });
            }
        });
    }

    async editAction(_target) {
        let documentId = this.getDocumentId(_target);
        await assistOS.UI.changeToDynamicPage("space-application-page", `${assistOS.space.id}/Space/document-view-page/${documentId}`);
    }

    async deleteAction(_target) {
        let message = "Are you sure you want to delete this analysis?";
        let confirmation = await assistOS.UI.showModal("confirm-action-modal", {message}, true);
        if (!confirmation) {
            return;
        }
        await documentModule.deleteDocument(assistOS.space.id, this.getDocumentId(_target));
        this.invalidate(this.refreshDocuments);
    }

    getDocumentId(_target) {
        return _target.getAttribute('data-id');
    }

    async openBiasDetectorModal() {
        const taskId = await assistOS.UI.showModal("bias-detector-modal", {
            "presenter": "bias-detector-modal"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async generateAction(_target) {
        const documentId = this.getDocumentId(_target);
        const sourceDoc = await documentModule.getDocument(assistOS.space.id, documentId);
        const spaceModule = require("assistos").loadModule("space", {});

        console.log('Source Document:', sourceDoc);

        // Initialize arrays for biases and scores
        let biases = [];
        let scores = [];
        let explanations = [];

        // Skip the first chapter (original text) and process the rest
        if (sourceDoc.chapters && sourceDoc.chapters.length > 1) {
            // Start from index 1 to skip the "Original Text" chapter
            for (let i = 1; i < sourceDoc.chapters.length; i++) {
                const chapter = sourceDoc.chapters[i];
                // Extract bias name and score from chapter title
                // Format: "bias_name (Score: {"x":number,"y":number})"
                const titleMatch = chapter.title.match(/(.+?)\s*\(Score:\s*(\{.*?\})\)/);

                if (titleMatch) {
                    const biasName = titleMatch[1].trim();
                    try {
                        const score = JSON.parse(titleMatch[2]);
                        biases.push(biasName);
                        scores.push(score);

                        // Get explanation from the chapter's paragraph
                        if (chapter.paragraphs && chapter.paragraphs.length > 0) {
                            explanations.push(chapter.paragraphs[0].text);
                        }
                    } catch (error) {
                        console.error('Error parsing score JSON:', error);
                    }
                }
            }
        }

        console.log('Extracted Biases:', biases);
        console.log('Extracted Scores:', scores);
        console.log('Extracted Explanations:', explanations);

        if (biases.length === 0 || scores.length === 0 || explanations.length === 0) {
            console.error('No bias data found in document');
            return;
        }

        // Create new document structure
        const newDocTitle = `bias_explained_${Date.now()}`;
        const chapters = [];

        // Create a temporary canvas in memory to generate the diagram
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1200;
        tempCanvas.height = 1000;
        const ctx = tempCanvas.getContext('2d');

        // Draw the visualization
        const width = tempCanvas.width;
        const height = tempCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const padding = 80;

        // Set up scale
        const maxValue = 10;
        const scale = (Math.min(width, height) - 2 * padding) / (2 * maxValue);

        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = '#EEEEEE';
        ctx.lineWidth = 1;
        for (let i = -maxValue; i <= maxValue; i++) {
            // Vertical grid line
            const x = centerX + i * scale;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();

            // Horizontal grid line
            const y = centerY - i * scale;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 1;

        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, centerY);
        ctx.lineTo(width - padding, centerY);
        ctx.stroke();

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(centerX, padding);
        ctx.lineTo(centerX, height - padding);
        ctx.stroke();

        // Add axis labels
        ctx.fillStyle = '#666666';
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // X-axis labels (only -10, -5, 5, 10)
        const labelValues = [-10, -5, 5, 10];
        labelValues.forEach(value => {
            const x = centerX + value * scale;
            ctx.fillText(value.toString(), x, centerY + 35);
        });

        // Y-axis labels (only -10, -5, 5, 10)
        labelValues.forEach(value => {
            const y = centerY - value * scale;
            ctx.fillText(value.toString(), centerX - 35, y);
        });

        // Add single 0 at center
        ctx.fillText('0', centerX - 35, centerY + 35);

        // Plot data points with labels
        ctx.fillStyle = '#000000';
        scores.forEach((score, i) => {
            // Handle both old and new score formats
            let x, y;
            if (typeof score === 'object' && score.x !== undefined && score.y !== undefined) {
                x = centerX + score.x * scale;
                y = centerY - score.y * scale; // Negative because canvas Y is inverted
            } else {
                // Legacy format - plot on diagonal
                x = centerX + score * scale;
                y = centerY - score * scale;
            }

            // Draw point
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Convert canvas to binary data
        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Upload the image and get its ID
        const imageId = await spaceModule.putImage(uint8Array);

        // Add first chapter with the image command
        chapters.push({
            title: "Bias Score Visualization",
            content: "",
            commands: {
                image: {
                    id: imageId,
                    width: tempCanvas.width,
                    height: tempCanvas.height
                }
            }
        });

        // Add chapters for each paragraph with analysis
        if (sourceDoc.paragraphs) {
            sourceDoc.paragraphs.forEach((para, index) => {
                chapters.push({
                    title: `Paragraph ${index + 1} Analysis`,
                    content: para.text,
                    analysis: para.analysis || "Analysis pending"
                });
            });
        }

        // Create the document object following the same structure as in GenerateAnalysis.js
        const documentObj = {
            title: newDocTitle,
            type: 'bias_explained',
            content: JSON.stringify(chapters, null, 2),
            abstract: JSON.stringify({
                type: "bias_explained",
                sourceDocumentId: documentId,
                chapters: chapters.map(c => ({ title: c.title })),
                timestamp: new Date().toISOString()
            }, null, 2),
            metadata: {
                id: null,  // This will be filled by the system
                title: newDocTitle
            }
        };

        // Use addDocument instead of createDocument
        const newDocId = await documentModule.addDocument(assistOS.space.id, documentObj);

        // Add chapters and paragraphs
        for (const chapter of chapters) {
            const chapterData = {
                title: chapter.title,
                idea: `Analysis of ${chapter.title}`
            };

            const chapterId = await documentModule.addChapter(assistOS.space.id, newDocId, chapterData);

            // Add the content as a paragraph with commands if present
            const paragraphObj = {
                text: chapter.content,
                commands: chapter.commands || {}
            };

            await documentModule.addParagraph(assistOS.space.id, newDocId, chapterId, paragraphObj);
        }

        // Refresh the documents and update the UI
        await this.refreshDocuments();
        this.invalidate(async () => {
            await this.beforeRender();
            await this.afterRender();
        });
    }

    render() {
        return `
            <div class="bias-detector-landing">
                <div class="main-card">
                    <div class="header">
                        <h2>Bias Analyses</h2>
                        <button class="action-btn" data-local-action="newAnalysis" data-tooltip="New Analysis">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="analyses-list">
                        ${this.tableRows}
                    </div>
                    <hr class="divider" />
                    <div class="header">
                        <h2>Explained Analyses</h2>
                    </div>
                    <div class="analyses-list">
                        ${this.explainedRows}
                    </div>
                </div>
            </div>
        `;
    }
}