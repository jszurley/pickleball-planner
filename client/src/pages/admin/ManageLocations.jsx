import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLocations, createLocation, updateLocation, deleteLocation } from '../../services/api';
import './Admin.css';

export default function ManageLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({ name: '', address: '' });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data);
    } catch (err) {
      setError('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setFormData({ name: location.name, address: location.address || '' });
    } else {
      setEditingLocation(null);
      setFormData({ name: '', address: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLocation(null);
    setFormData({ name: '', address: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, formData);
      } else {
        await createLocation(formData);
      }
      handleCloseModal();
      loadLocations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save location');
    }
  };

  const handleDelete = async (locationId) => {
    if (!confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      await deleteLocation(locationId);
      loadLocations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete location');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <Link to="/admin" className="back-link">
        &larr; Back to Admin
      </Link>

      <div className="page-header">
        <h1>Manage Locations</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Locations ({locations.length})</h2>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="empty-state">
            <p>No locations yet.</p>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Add your first location
            </button>
          </div>
        ) : (
          <div className="grid grid-2">
            {locations.map((location) => (
              <div key={location.id} className="card">
                <h3>{location.name}</h3>
                {location.address && (
                  <p className="text-muted">{location.address}</p>
                )}
                <div className="flex gap-1 mt-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleOpenModal(location)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(location.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLocation ? 'Edit Location' : 'Add Location'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Community Center Courts"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Address (optional)</label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLocation ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
