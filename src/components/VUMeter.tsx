import React, { useEffect, useRef } from 'react';

interface VUMeterProps {
  analyser: AnalyserNode | null;
}

export const VUMeter: React.FC<VUMeterProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const height = (average / 255) * canvas.height;

      // Draw background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw gradient bar
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#10b981'); // Green
      gradient.addColorStop(0.6, '#f59e0b'); // Orange
      gradient.addColorStop(0.9, '#ef4444'); // Red

      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - height, canvas.width, height);

      // Draw peak line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const y = (canvas.height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser]);

  return (
    <div className="h-48 w-8 bg-black rounded-lg overflow-hidden border border-white/10">
      <canvas ref={canvasRef} width={32} height={192} className="w-full h-full" />
    </div>
  );
};
