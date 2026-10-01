export default function FollowedCompaniesView({
  followedCompanies,
  companyFormOpen,
  setCompanyFormOpen,
  companyName,
  setCompanyName,
  companyTicker,
  setCompanyTicker,
  onAddCompany,
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
                <div className="company-select">
                  <span className="company-ticker">{company.ticker}</span>
                  <span className="company-name">{company.name}</span>
                </div>
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
          <p className="company-strip-note">Company statistics are unavailable until a permitted fundamentals source is configured.</p>
        </>
      ) : (
        <div className="company-empty-state">
          <span>Follow a company by name and ticker to keep it in this browser and prepare cited research questions.</span>
        </div>
      )}
    </section>
  )
}