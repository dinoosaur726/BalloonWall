
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

    static async generate(nickname: string, amount: number, sigConfig?: { streamerId?: string, signatureBalloons: number[], customBalloons?: { id: string, amount: number, imageDataUrl: string, useForNormal: boolean, useForAd: boolean }[] }, type: 'Normal' | 'Ad' = 'Normal'): Promise<{ imageUrl: string, isCustom: boolean }> {
        let balloonSrc = '';
        let isExternal = false;
        let isCustom = false;
        let isAd = type === 'Ad';

        // 1. Signature Check (Only for Normal balloons)
        if (!isAd && sigConfig?.streamerId && sigConfig.signatureBalloons.includes(amount)) {
            balloonSrc = `https://static.file.sooplive.co.kr/starballoon/story_m/${sigConfig.streamerId}_${amount}.png`;
            isExternal = true;
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

        // Custom balloons: return the uploaded image directly without compositing
        if (isCustom) {
            return { imageUrl: balloonSrc, isCustom: true };
        }

        const bgSrc = isAd ? 'assets/n_b_ad.png' : 'assets/n_b.png';

        try {
            let balloonImg: HTMLImageElement;
            let bgImg: HTMLImageElement;

            // Load Background (always needed)
            bgImg = await this.loadImage(bgSrc);

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

            // ... (Canvas creation)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            // Python Logic: width is balloon width. Height is sum.
            canvas.width = balloonImg.width;
            canvas.height = balloonImg.height + bgImg.height;

            // 1. Draw Balloon at (0,0)
            ctx.drawImage(balloonImg, 0, 0);

            // 2. Draw Background Panel at (0, balloonHeight)
            ctx.drawImage(bgImg, 0, balloonImg.height);

            // 3. Draw Amount on Balloon (ONLY IF NOT EXTERNAL AND NOT AD)
            if (!isExternal && !isAd) {
                await this.loadFont();

                // Python: d_p_x centered on balloon, y=120
                // Font size 50
                ctx.font = `50px "${this.fontName}", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const amountText = amount.toString();
                const balloonCenterX = balloonImg.width / 2;
                const amountY = 120;

                // Outline (3px radius in Python -> ~6-8px stroke)
                ctx.lineWidth = 8;
                ctx.strokeStyle = 'white';
                ctx.lineJoin = 'round';
                ctx.strokeText(amountText, balloonCenterX, amountY);

                // Fill
                ctx.fillStyle = '#ff2f00';
                ctx.fillText(amountText, balloonCenterX, amountY);
            }

            // 4. Draw Text on Background Panel
            // ... (rest is same)
            // But we need font loaded effectively. 
            // If signature, we skipped loadFont? No, we need it for bottom panel.
            if (isExternal) {
                await this.loadFont();
            }

            // ... Text logic ...
            ctx.font = `20px "${this.fontName}", sans-serif`;

            const line1 = `${nickname}님`;
            const line2 = isAd ? `애드벌룬 ${amount.toLocaleString()}개` : `별풍선 ${amount.toLocaleString()}개`;

            const bgCenterX = bgImg.width / 2;

            const estimatedTextHeight = 20;
            const textY1_Local = (bgImg.height - estimatedTextHeight) / 4;
            const textY1_Global = balloonImg.height + textY1_Local;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.fillStyle = isAd ? 'white' : '#ff2f00';
            ctx.fillText(line1, bgCenterX, textY1_Global);

            // Line 2
            const textY2_Global = textY1_Global + estimatedTextHeight + 5;

            ctx.fillStyle = isAd ? '#28e3b8' : 'black';
            ctx.fillText(line2, bgCenterX, textY2_Global);

            return { imageUrl: canvas.toDataURL('image/png'), isCustom: false };

        } catch (error) {
            this.log(`Balloon generation failed: ${error}`);
            throw error;
        }
    }
}
