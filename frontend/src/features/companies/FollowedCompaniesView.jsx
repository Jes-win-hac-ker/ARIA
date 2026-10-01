export default function FollowedCompaniesView({
  followedCompanies,
  selectedCompanies,
  companyFormOpen,
  setCompanyFormOpen,
  companyName,
  setCompanyName,
  companyTicker,
  setCompanyTicker,
  onAddCompany,
  onCompare,
  onToggleCompany,
  onResearchCompany,
  onRemoveCompany,
}) {
  return (
    <section className="company-strip library-section" id="followed-companies" aria-labelledby="companies-heading">
      <div className="company-strip-heading">
        <div>
          <h1 id="companies-heading">Followed companies</h1>
          <p>Saved in this browser · fundamentals provider not configured</p>
        </div>
        <div className="company-strip-actions">
          <button
            className="compare-button"
            type="button"
            onClick={onCompare}
            disabled={selectedCompanies.length < 2}
            title={selectedCompanies.length < 2 ? 'Select at least two companies to compare' : 'Prepare a sourced comparison question'}
          >
            Compare selected{selectedCompanies.length ? ` (${selectedCompanies.length})` : ''}
          </button>
          <button className="add-company-button" type="button" onClick={() => setCompanyFormOpen((open) => !open)}>
            <span aria-hidden="true">＋</span> Follow company
          </button>
        </div>
      </div>

      {companyFormOpen && (
        <form className="company-add-form" onSubmit={onAddCompany}>
          <label>
            Company name
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={120} placeholder="Company name" required />
          </label>
          <label>
            Ticker
            <input value={companyTicker} onChange={(event) => setCompanyTicker(event.target.value)} maxLength={20} placeholder="Ticker" required />
          </label>
          <button className="add-company-button" type="submit">Add to list</button>
        </form>
      )}

      {followedCompanies.length ? (
        <>
          <div className="followed-company-list">
            {followedCompanies.map((company) => (
              <article className="followed-company-card" key={company.ticker}>
                <label className="company-select">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(company.ticker)}
                    disabled={!selectedCompanies.includes(company.ticker) && selectedCompanies.length >= 3}
                    onChange={() => onToggleCompany(company.ticker)}
                    aria-label={`Select ${company.name} for comparison`}
                  />
                  <span className="company-ticker">{company.ticker}</span>
                  <span className="company-name">{company.name}</span>
                </label>
                <span className="company-data-status"><span />Data source not configured</span>
                <button className="company-research-button" type="button" onClick={() => onResearchCompany(company)}>
                  Research
                </button>
                <button
                  className="remove-company-button"
                  type="button"
                  aria-label={`Remove ${company.name} from followed companies`}
                  onClick={() => onRemoveCompany(company)}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
          <p className="company-strip-note">Company statistics are unavailable until a permitted fundamentals source is configured. Compare prepares a cited research question; it does not calculate metrics.</p>
        </>
      ) : (
        <div className="company-empty-state">
          <span>Follow a company by name and ticker to keep it in this browser and prepare cited research questions.</span>
        </div>
      )}
    </section>
  )
}