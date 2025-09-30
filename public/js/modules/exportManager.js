/**
 * Export Manager Module
 * Handles various export formats (PDF, TXT, Word)
 */

export class ExportManager {
    constructor() {
        this.ensureLibrariesLoaded();
    }

    ensureLibrariesLoaded() {
        // Check if required libraries are loaded
        if (typeof window.jspdf === 'undefined') {
            console.warn('jsPDF library not loaded. PDF export will not be available.');
        }
    }

    async exportToPDF(originalText, translatedText, metadata = {}) {
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF export library not loaded');
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text('Translation Export', 20, 20);
            
            doc.setFontSize(12);
            doc.text('Original Text:', 20, 40);
            
            // Handle long text by splitting into multiple lines
            const originalLines = doc.splitTextToSize(originalText || 'No text available', 170);
            doc.text(originalLines, 20, 50);
            
            doc.text('Translated Text:', 20, 80);
            const translatedLines = doc.splitTextToSize(translatedText || 'No translation available', 170);
            doc.text(translatedLines, 20, 90);
            
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 120);
            
            if (metadata.fromLanguage && metadata.toLanguage) {
                doc.text(`Language: ${metadata.fromLanguage} → ${metadata.toLanguage}`, 20, 130);
            }
            
            doc.save('translation-export.pdf');
            return { success: true, message: 'PDF exported successfully!' };
        } catch (error) {
            console.error('PDF export failed:', error);
            throw new Error('PDF export failed: ' + error.message);
        }
    }

    exportToTXT(originalText, translatedText, metadata = {}) {
        try {
            const content = `Translation Export
Generated: ${new Date().toLocaleString()}

Original Text:
${originalText || 'No text available'}

Translated Text:
${translatedText || 'No translation available'}

Metadata:
- From Language: ${metadata.fromLanguage || 'Unknown'}
- To Language: ${metadata.toLanguage || 'Unknown'}
- Generated: ${new Date().toLocaleString()}`;

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translation-export.txt';
            a.click();
            URL.revokeObjectURL(url);
            
            return { success: true, message: 'TXT exported successfully!' };
        } catch (error) {
            console.error('TXT export failed:', error);
            throw new Error('TXT export failed: ' + error.message);
        }
    }

    exportToWord(originalText, translatedText, metadata = {}) {
        try {
            const content = `
                <html>
                <head>
                    <title>Translation Export</title>
                    <meta charset="UTF-8">
                </head>
                <body>
                    <h1>Translation Export</h1>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                    
                    <h2>Original Text:</h2>
                    <p>${originalText || 'No text available'}</p>
                    
                    <h2>Translated Text:</h2>
                    <p>${translatedText || 'No translation available'}</p>
                    
                    <h2>Metadata:</h2>
                    <ul>
                        <li><strong>From Language:</strong> ${metadata.fromLanguage || 'Unknown'}</li>
                        <li><strong>To Language:</strong> ${metadata.toLanguage || 'Unknown'}</li>
                        <li><strong>Generated:</strong> ${new Date().toLocaleString()}</li>
                    </ul>
                </body>
                </html>
            `;

            const blob = new Blob([content], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translation-export.doc';
            a.click();
            URL.revokeObjectURL(url);
            
            return { success: true, message: 'Word document exported successfully!' };
        } catch (error) {
            console.error('Word export failed:', error);
            throw new Error('Word export failed: ' + error.message);
        }
    }

    async exportConversation(conversations, format = 'pdf') {
        try {
            let content = '';
            let filename = '';

            switch (format) {
                case 'pdf':
                    return await this.exportConversationToPDF(conversations);
                case 'txt':
                    content = this.formatConversationAsText(conversations);
                    filename = 'conversation-export.txt';
                    break;
                case 'word':
                    content = this.formatConversationAsHTML(conversations);
                    filename = 'conversation-export.doc';
                    break;
                default:
                    throw new Error('Unsupported export format');
            }

            const blob = new Blob([content], { 
                type: format === 'word' ? 'application/msword' : 'text/plain' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            return { success: true, message: `${format.toUpperCase()} exported successfully!` };
        } catch (error) {
            console.error('Conversation export failed:', error);
            throw new Error('Conversation export failed: ' + error.message);
        }
    }

    formatConversationAsText(conversations) {
        let content = `Conversation Export\nGenerated: ${new Date().toLocaleString()}\n\n`;
        
        conversations.forEach((conv, index) => {
            content += `--- Translation ${index + 1} ---\n`;
            content += `Timestamp: ${new Date(conv.timestamp).toLocaleString()}\n`;
            content += `Languages: ${conv.fromLanguage} → ${conv.toLanguage}\n`;
            content += `Original: ${conv.original}\n`;
            content += `Translated: ${conv.translated}\n\n`;
        });

        return content;
    }

    formatConversationAsHTML(conversations) {
        let content = `
            <html>
            <head>
                <title>Conversation Export</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .translation { border: 1px solid #ccc; margin: 10px 0; padding: 15px; }
                    .timestamp { color: #666; font-size: 12px; }
                    .languages { color: #0066cc; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>Conversation Export</h1>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        `;
        
        conversations.forEach((conv, index) => {
            content += `
                <div class="translation">
                    <h3>Translation ${index + 1}</h3>
                    <p class="timestamp">${new Date(conv.timestamp).toLocaleString()}</p>
                    <p class="languages">${conv.fromLanguage} → ${conv.toLanguage}</p>
                    <p><strong>Original:</strong> ${conv.original}</p>
                    <p><strong>Translated:</strong> ${conv.translated}</p>
                </div>
            `;
        });

        content += '</body></html>';
        return content;
    }

    async exportConversationToPDF(conversations) {
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF export library not loaded');
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text('Conversation Export', 20, 20);
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
            
            let yPosition = 50;
            
            conversations.forEach((conv, index) => {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                doc.setFontSize(14);
                doc.text(`Translation ${index + 1}`, 20, yPosition);
                yPosition += 10;
                
                doc.setFontSize(10);
                doc.text(`Timestamp: ${new Date(conv.timestamp).toLocaleString()}`, 20, yPosition);
                yPosition += 8;
                doc.text(`Languages: ${conv.fromLanguage} → ${conv.toLanguage}`, 20, yPosition);
                yPosition += 8;
                
                doc.setFontSize(12);
                doc.text('Original:', 20, yPosition);
                yPosition += 8;
                const originalLines = doc.splitTextToSize(conv.original, 170);
                doc.text(originalLines, 20, yPosition);
                yPosition += originalLines.length * 6 + 5;
                
                doc.text('Translated:', 20, yPosition);
                yPosition += 8;
                const translatedLines = doc.splitTextToSize(conv.translated, 170);
                doc.text(translatedLines, 20, yPosition);
                yPosition += translatedLines.length * 6 + 15;
            });
            
            doc.save('conversation-export.pdf');
            return { success: true, message: 'PDF exported successfully!' };
        } catch (error) {
            console.error('PDF export failed:', error);
            throw new Error('PDF export failed: ' + error.message);
        }
    }
}
