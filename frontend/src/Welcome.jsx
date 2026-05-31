import './Welcome.css';

function Welcome({ onStart, loading, loadingIcon }) {
  const features = [
    {
      title: 'Request a Role',
      description: 'Submit a request for new SAP roles with ease',
      color: 'orange',
      icon: '📋'
    },
    {
      title: 'Search Roles',
      description: 'Find roles by name, tcode, or description keyword',
      color: 'blue',
      icon: '🔍'
    },
    {
      title: 'Check Status',
      description: 'Track the status of your role requests',
      color: 'purple',
      icon: '✓'
    },
    {
      title: 'View Access',
      description: 'See your existing roles and access levels',
      color: 'green',
      icon: '👤'
    }
  ];

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1 className="welcome-title">Welcome to SAP Role Request Agent!</h1>
        <p className="welcome-subtitle">Your smart companion for SAP role management.</p>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className={`feature-card ${feature.color}`}>
              <div className="card-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>

        <button className="lets-go-btn" onClick={onStart} disabled={loading}>
          Let's go
        </button>
      </div>
      {loading && (
        <div className="welcome-loading-overlay">
          <div className="loading-popup">
            <img src={loadingIcon} alt="Loading" className="loading-popup-icon" />
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Welcome;
