import { useState, useEffect } from 'react';

type CountdownTimerProps = {
    minutes: number;
    onComplete: () => void;
}

export const CountdownTimer = ({ minutes, onComplete }: CountdownTimerProps) => {
    const [timeLeft, setTimeLeft] = useState(Math.floor(minutes * 60)); // Convertir minutos a segundos

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (onComplete) onComplete(); // Llamar al callback cuando termine
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Limpiar el temporizador cuando el componente se desmonte
        return () => clearInterval(timer);
    }, [onComplete]);

    // Formatear el tiempo en minutos y segundos
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) {
            return `${secs.toString().padStart(2, '0')} sec`;
        }
        return `${mins.toString().padStart(2, '0')}: ${secs.toString().padStart(2, '0')} min`;
    };

    const getColor = () => {
        if (timeLeft <= 60) return 'red'; // Último minuto
        if (timeLeft <= 240) return 'gray'; // Más de 4 minutos
        if (timeLeft <= 420) return 'orange'; // Últimos 6 minutos
        return 'green'; //mayor a 6 minutos
    };

    return (
        <span style={{ color: getColor() }}>
            {formatTime(timeLeft)}
        </span>
    );
};

