import { useState } from 'react';
import { reserveSpot, cancelReservation } from '../services/api';
import './ReservationButton.css';

export default function ReservationButton({ event, onReservationChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFull = parseInt(event.reservation_count) >= event.max_spots;
  const isReserved = event.is_reserved;

  const handleReserve = async () => {
    setLoading(true);
    setError('');
    try {
      await reserveSpot(event.id);
      if (onReservationChange) {
        onReservationChange();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reserve');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      await cancelReservation(event.id);
      if (onReservationChange) {
        onReservationChange();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel reservation');
    } finally {
      setLoading(false);
    }
  };

  if (isReserved) {
    return (
      <div className="reservation-button-container">
        <button
          className="btn btn-reserved"
          onClick={handleCancel}
          disabled={loading}
        >
          {loading ? 'Cancelling...' : 'Reserved - Click to Cancel'}
        </button>
        {error && <span className="reservation-error">{error}</span>}
      </div>
    );
  }

  if (isFull) {
    return (
      <button className="btn btn-full" disabled>
        Event Full
      </button>
    );
  }

  return (
    <div className="reservation-button-container">
      <button
        className="btn btn-primary"
        onClick={handleReserve}
        disabled={loading}
      >
        {loading ? 'Reserving...' : 'Reserve Spot'}
      </button>
      {error && <span className="reservation-error">{error}</span>}
    </div>
  );
}
