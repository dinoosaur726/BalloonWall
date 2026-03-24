
import { isElectron } from './env'

export class BalloonGenerator {
    private static fontName = 'NanumGothicExtraBold';
    private static fontLoaded = false;

    private static log(msg: string) {
        console.log(`[BalloonGenerator] ${msg}`);
        if (window.ipcRenderer) {
            window.ipcRenderer.send('log', `[BalloonGenerator] ${msg}`);
        }
    }

    private static async loadFont() {
        if (this.fontLoaded) return;
        try {
            this.log('Loading font...');
            const font = new FontFace(this.fontName, 'url(assets/NanumGothicExtraBold.ttf)');
            await font.load();
            document.fonts.add(font);
            this.fontLoaded = true;
            this.log('Font loaded successfully.');
        } catch (e) {
            this.log(`Failed to load font, using fallback: ${e}`);
        }
    }

    private static getBalloonImage(amount: number): string {
        if (amount >= 1 && amount <= 99) return 'assets/ba_step2.png';
        if (amount >= 100 && amount <= 300) return 'assets/ba_step3.png';
        if (amount >= 301 && amount <= 999) return 'assets/ba_step4.png';
        if (amount >= 1000 && amount <= 4999) return 'assets/ba_step5.png';
        if (amount >= 5000) return 'assets/ba_step6.png';
        return 'assets/ba_step2.png';
    }

    private static loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise(async (resolve, reject) => {
            console.log(`[BalloonGenerator] Loading image: ${src}`);

            let finalSrc = src;

            // Use IPC for external URLs to bypass CORS/CSP (Electron only)
            if (src.startsWith('http') && isElectron() && window.ipcRenderer) {
                try {
                    const dataUrl = await window.ipcRenderer.invoke('fetch-image', src);
                    if (dataUrl) {
                        finalSrc = dataUrl;
                    } else {
                        throw new Error('IPC fetch returned null');
                    }
                } catch (e) {
                    console.error(`[BalloonGenerator] IPC fetch failed for ${src}, falling back to direct load.`, e);
                }
            } else if (src.startsWith('http') && !isElectron()) {
                // Browser mode: try direct fetch (works for CORS-friendly URLs)
                try {
                    const response = await fetch(src);
                    if (response.ok) {
                        const blob = await response.blob();
                        finalSrc = URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.error(`[BalloonGenerator] Direct fetch failed for ${src}, using src directly.`, e);
                }
            }

            const img = new Image();
            // Only use crossOrigin if it is NOT a data URL and is external
            if (!finalSrc.startsWith('data:') && finalSrc.startsWith('http')) {
                img.crossOrigin = 'Anonymous';
            }

            const timeout = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                reject(new Error(`Timeout loading image ${src}`));
            }, 10000); // Increased timeout

            img.onload = () => {
                clearTimeout(timeout);
                console.log(`[BalloonGenerator] Loaded image: ${src}`);
                resolve(img);
            };
            img.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to load image ${src}: ${JSON.stringify(e)}`));
            };
            img.src = finalSrc;
        });
    }

    static async generate(_nickname: string, amount: number, sigConfig?: { streamerId?: string, signatureBalloons: number[], customBalloons?: { id: string, amount: number, imageDataUrl: string, useForNormal: boolean, useForAd: boolean }[] }, type: 'Normal' | 'Ad' = 'Normal'): Promise<{ imageUrl: string, isCustom: boolean }> {
        let balloonSrc = '';
        let isExternal = false;
        let isCustom = false;
        let isAd = type === 'Ad';
        let isSignatureSource = false;

        // 1. Signature Check (Only for Normal balloons)
        if (!isAd && sigConfig?.streamerId && sigConfig.signatureBalloons.includes(amount)) {
            balloonSrc = `https://static.file.sooplive.co.kr/starballoon/story_m/${sigConfig.streamerId}_${amount}.png`;
            isExternal = true;
            isSignatureSource = true;
            this.log(`Attempting to load signature balloon: ${balloonSrc}`);
        }

        // 2. Custom Balloon Check (추가시그)
        if (!isExternal && sigConfig?.customBalloons) {
            const match = sigConfig.customBalloons.find(cb =>
                cb.amount === amount &&
                (isAd ? cb.useForAd : cb.useForNormal)
            );
            if (match) {
                balloonSrc = match.imageDataUrl;
                isExternal = true;
                isCustom = true;
                this.log(`Using custom balloon for amount ${amount}`);
            }
        }

        // 3. Standard External Check (If not signature/custom and Normal)
        if (!isExternal && !isAd) {
            // Try the standard external URL first
            const standardUrl = `https://res.sooplive.co.kr/new_player/items/m_balloon_${amount}.png`;
            try {
                // Heuristic: Set it here, check load later.
                balloonSrc = standardUrl;
                isExternal = true;
            } catch (e) {
                // Ignored
            }
        }

        // 4. Ad Balloon External Check
        if (isAd && !isCustom) {
            balloonSrc = `https://static.file.sooplive.co.kr/adballoon/ceremony/mobile_${amount}.png`;
            isExternal = true;
        }

        // Custom balloons: load image, stretch to fit, return
        if (isCustom) {
            try {
                const customImg = await this.loadImage(balloonSrc);
                const stretched = document.createElement('canvas');
                stretched.width = 480;
                stretched.height = 285;
                const sCtx = stretched.getContext('2d');
                if (sCtx) {
                    sCtx.drawImage(customImg, 0, 0, 480, 285);
                }
                return { imageUrl: stretched.toDataURL('image/png'), isCustom: true };
            } catch (e) {
                this.log(`Custom balloon stretch failed: ${e}`);
                return { imageUrl: balloonSrc, isCustom: true };
            }
        }

        try {
            let balloonImg: HTMLImageElement;

            // Load Balloon with fallback chain
            const loadBalloon = async (): Promise<HTMLImageElement> => {
                // Try primary source first
                try {
                    if (!isExternal && !isAd) {
                        balloonSrc = this.getBalloonImage(amount);
                    }
                    return await this.loadImage(balloonSrc);
                } catch (error) {
                    this.log(`External load failed for ${balloonSrc}. Falling back.`);

                    if (isAd) {
                        balloonSrc = 'assets/ad.png';
                        isExternal = false;
                        return await this.loadImage(balloonSrc);
                    }

                    if (sigConfig?.signatureBalloons.includes(amount)) {
                        // Signature failed -> try Custom -> Standard External -> Local
                        isSignatureSource = false;
                        if (sigConfig?.customBalloons) {
                            const match = sigConfig.customBalloons.find(cb => cb.amount === amount && cb.useForNormal);
                            if (match) {
                                try {
                                    isExternal = true;
                                    return await this.loadImage(match.imageDataUrl);
                                } catch (_) { /* continue fallback */ }
                            }
                        }
                        try {
                            const standardUrl = `https://res.sooplive.co.kr/new_player/items/m_balloon_${amount}.png`;
                            isExternal = true;
                            return await this.loadImage(standardUrl);
                        } catch (_) { /* continue fallback */ }
                    } else if (isCustom) {
                        // Custom failed -> try Standard External -> Local
                        try {
                            const standardUrl = `https://res.sooplive.co.kr/new_player/items/m_balloon_${amount}.png`;
                            isExternal = true;
                            return await this.loadImage(standardUrl);
                        } catch (_) { /* continue fallback */ }
                    }

                    // Final local fallback
                    balloonSrc = this.getBalloonImage(amount);
                    isExternal = false;
                    return await this.loadImage(balloonSrc);
                }
            };

            balloonImg = await loadBalloon();

            // Crop external balloon images: signature → bottom 293x163, standard → bottom 293x174
            if (isExternal && balloonImg.width === 293 && balloonImg.height === 248) {
                const cropH = isSignatureSource ? 163 : 174;
                const cropY = 248 - cropH;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = 293;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                    cropCtx.drawImage(balloonImg, 0, cropY, 293, cropH, 0, 0, 293, cropH);
                    balloonImg = new Image();
                    await new Promise<void>((resolve) => {
                        balloonImg.onload = () => resolve();
                        balloonImg.src = cropCanvas.toDataURL('image/png');
                    });
                }
            }

            // Canvas sized to balloon image only (Card component handles text area separately)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            canvas.width = balloonImg.width;
            canvas.height = balloonImg.height;

            // 1. Draw Balloon at (0,0)
            ctx.drawImage(balloonImg, 0, 0);

            // 2. Draw Amount on Balloon (ONLY IF NOT EXTERNAL AND NOT AD)
            if (!isExternal && !isAd) {
                await this.loadFont();

                ctx.font = `50px "${this.fontName}", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const amountText = amount.toString();
                const balloonCenterX = balloonImg.width / 2;
                const amountY = 120;

                ctx.lineWidth = 8;
                ctx.strokeStyle = 'white';
                ctx.lineJoin = 'round';
                ctx.strokeText(amountText, balloonCenterX, amountY);

                ctx.fillStyle = '#ff2f00';
                ctx.fillText(amountText, balloonCenterX, amountY);
            }

            // Crop local/ad balloon images to bottom 293x162
            let sourceForStretch: HTMLCanvasElement = canvas;
            if (!isExternal) {
                const cropH = 162;
                const cropY = canvas.height - cropH;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = 293;
                cropCanvas.height = cropH;
                const cCtx = cropCanvas.getContext('2d');
                if (cCtx) {
                    cCtx.drawImage(canvas, 0, cropY, 293, cropH, 0, 0, 293, cropH);
                    sourceForStretch = cropCanvas;
                }
            }

            // Stretch all images to fit card image dimensions (480x285, 16:9.5)
            const stretched = document.createElement('canvas');
            stretched.width = 480;
            stretched.height = 285;
            const sCtx = stretched.getContext('2d');
            if (sCtx) {
                sCtx.drawImage(sourceForStretch, 0, 0, 480, 285);
            }
            return { imageUrl: stretched.toDataURL('image/png'), isCustom: false };

        } catch (error) {
            this.log(`Balloon generation failed: ${error}`);
            throw error;
        }
    }
}
