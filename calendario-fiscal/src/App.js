import DataLoader from './DataLoader'

function App() {
  return (
    <div className="calendar-container">
      <div className="main-content">
        <div className="calendar-wrapper">
          <h1 className="page-title">Calendário Fiscal</h1>
          <DataLoader />
        </div>
      </div>
    </div>
  )
}

export default App

