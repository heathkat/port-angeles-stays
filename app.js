
    const publishedView = document.documentElement.dataset.mode === 'published';
    const originalStays = [];
    let stays = [];
    let importedDataset = null;
    let downtownIds = new Set();
    const accessNotes = {};
    const money = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD' });
    const areaLabels = { downtown_port_angeles:'Downtown Port Angeles', wider_port_angeles:'Wider Port Angeles', sequim:'Sequim', joyce:'Joyce', unknown:'Area unconfirmed' };
    const providerLabels = { airbnb:'Airbnb', vrbo:'Vrbo', booking:'Booking.com', brigadoon:'Brigadoon', olympic_coast_retreats:'Olympic Coast Retreats', port_angeles_inn:'Port Angeles Inn (direct)', furnished_finder:'Furnished Finder' };
    const escapeHtml = value => String(value).replace(/[&<>"']/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
    const checkedDateFormat = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'});
    const tripDateFormat = new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
    const displayDate = value => checkedDateFormat.format(new Date(value));
    function tripSummary(trip) {
      return `${tripDateFormat.formatRange(new Date(trip.checkIn),new Date(trip.checkOut))} \u00b7 ${trip.nights} nights \u00b7 ${trip.adults} ${trip.adults === 1 ? 'adult' : 'adults'}`;
    }
    function sourceCoverageHtml(entry) {
      const label = {verified:'A trip price was checked.',leads_only:'Listings found; prices not checked.',partially_verified:'Some details checked.',not_authorized:'Listing collection not authorized.',not_searched:'Not checked in this update.',blocked:'Could not check.'}[entry.status] || 'See research notes.';
      const link = entry.url ? `<p><a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">Browse this source directly</a></p>` : '';
      return `<strong>${escapeHtml(providerLabels[entry.provider] || entry.provider)}:</strong> ${escapeHtml(label)}${link}<details><summary>Research notes</summary><p>${escapeHtml(entry.details)}</p></details>`;
    }
    function publishedCardHtml(stay,item,link,noteUnsaved,uncertain) {
      const kitchen = {full:'Full kitchen listed',kitchenette:'Kitchenette listed',none:'No kitchen',unknown:'Kitchen: not confirmed'}[stay.amenities.kitchen];
      const washer = stay.amenities.washer, dryer = stay.amenities.dryer;
      const machineText = (name,machine) => machine.state === 'unknown' ? `${name}: not confirmed` : machine.state === 'no' ? `No ${name.toLowerCase()}` :
        `${name} listed${{in_unit:' in unit',shared:' (shared)',off_site:' (off site)',unknown:''}[machine.location]}`;
      const laundry = washer.state === 'yes' && dryer.state === 'yes'
        ? washer.location === dryer.location && washer.location !== 'unknown'
          ? {in_unit:'Washer & dryer in unit',shared:'Shared washer & dryer',off_site:'Washer & dryer off site'}[washer.location]
          : [washer,dryer].some(machine => ['shared','off_site'].includes(machine.location)) ? `${machineText('Washer',washer)}; ${machineText('dryer',dryer)}`
            : 'Washer & dryer listed; private use not confirmed'
        : washer.state === 'unknown' && dryer.state === 'unknown' ? 'Laundry: not confirmed'
          : `${machineText('Washer',washer)}; ${machineText('dryer',dryer)}`;
      const route = stay.proximity;
      const routeDescription = route.description || '';
      const mappedWalk = route.basis === 'verified_route' && route.walkingMinutes !== null;
      const location = mappedWalk ? `About ${route.walkingMinutes} minutes to ${route.destination.includes('(downtown shopping reference)') ? 'downtown shops' : route.destination} (map estimate)`
        : routeDescription.includes('across from Field Arts Hall') ? 'Downtown, across from Field Arts Hall'
          : routeDescription.includes('short drive') ? 'A short drive to downtown, per listing'
            : `${areaLabels[stay.area]} \u00b7 Walk to downtown not checked`;
      let access = stay.amenities.stairs === 'yes' ? 'Stairs listed; ask about access.' : stay.amenities.stairs === 'unknown' ? 'Ask about stairs and access.' : '';
      if (stay.tradeoffs.some(note => note.includes('full bathroom is upstairs'))) access = 'Full bathroom upstairs.';
      if (routeDescription.includes('return involves climbing')) access = 'Uphill return; the downtown shortcut uses steps.';
      if (stay.tradeoffs.some(note => note.includes('double/full, not a queen or king'))) access += ' Main bed: double/full, not queen or king.';
      if (stay.tradeoffs.some(note => note.includes('Hotel says no A/C'))) access += ' No air conditioning.';
      const name = stay.name.replace(/ - Queen \/ non-harbor view \(direct\)$/,'');
      const unit = stay.type === 'hotel' ? (stay.unit || 'Room not confirmed').replace('1 Queen Size Bed NON Harbor View / Room only','Queen room \u00b7 No harbor view')
        : `${{entire_rental:'Entire place',private_room:'Private room',unknown:'Entire or shared: not confirmed'}[stay.type]}${stay.amenities.bedrooms === null ? '' : ` \u00b7 ${stay.amenities.bedrooms} ${stay.amenities.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`}`;
      const quote = stay.quote;
      const hasPrice = quoteMatches && quote.amount !== null;
      const amount = hasPrice ? quote.currency === 'USD' ? money.format(quote.amount) : `${quote.currency || 'Currency not confirmed'} ${quote.amount.toLocaleString('en-US')}` : 'Check price';
      const basis = hasPrice ? quote.basis === 'whole_stay' ? `for ${importedDataset.trip.nights} nights` : quote.basis === 'nightly' ? 'per night, not a trip total' : 'total not confirmed' : '';
      const priceNotes = [];
      if (hasPrice) {
        if (quote.status === 'historical_quote') priceNotes.push('Previous price, not a current quote.');
        if (quote.status === 'advertised_rate') priceNotes.push('Advertised rate, not checked for this trip.');
        priceNotes.push(quote.totalStatus === 'complete' ? 'Includes listed taxes and fees.' : quote.totalStatus === 'incomplete' ? 'Extra charges apply.' : 'Taxes and fees not confirmed.');
        if (quote.checkedAt) priceNotes.push(`Checked ${displayDate(quote.checkedAt)}.`);
      }
      if (!quoteMatches) priceNotes.push('Not checked for these dates or guests.');
      if (quoteMatches && quote.availability === 'request_to_book') priceNotes.push('Host approval required.');
      if (quoteMatches && quote.availability === 'unavailable') priceNotes.push('Unavailable when checked.');
      if (hasPrice && quote.availability === 'unknown') priceNotes.push('Availability not confirmed.');
      const sourceLabel = evidence => ({search_result:'Listing search result',route_tool:'Map route',listing_page:evidence.scope === 'property' ? 'Property website' : 'Listing page',browser:'Booking page',api:'Source details',user_supplied:'Provided details'}[evidence.method] || 'Source details');
      return `<div class="body">
        <div class="provider">${escapeHtml(stay.provider.replace(' (direct)',''))}</div>
        <h3>${escapeHtml(name)}</h3><p class="description">${escapeHtml(unit)}</p>
        <p class="travel">${escapeHtml(location)}</p>
        <div class="features"><span class="feature ${stay.kitchen ? '' : 'partial'}">${escapeHtml(kitchen)}</span><span class="feature ${stay.laundry ? '' : 'partial'}">${escapeHtml(laundry)}</span></div>
        ${access ? `<p class="caution"><strong>Worth knowing:</strong> ${escapeHtml(access)}</p>` : ''}
        <div class="price"><span class="amount">${escapeHtml(amount)}</span> <small>${escapeHtml(basis)}</small>${priceNotes.length ? `<p class="price-note">${escapeHtml(priceNotes.join(' '))}</p>` : ''}</div>
        ${uncertain ? '<p class="budget-fit">Some details still need checking against your filters.</p>' : ''}
        <div class="actions">${link ? `<a class="listing" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(stay.name)} on ${escapeHtml(stay.provider)}">View on ${escapeHtml(stay.provider.replace(' (direct)',''))}</a>` : '<span class="listing" aria-disabled="true">Check trip dates</span>'}<button class="save" aria-pressed="${item.saved}" aria-label="${item.saved ? 'Unsave' : 'Save'} ${escapeHtml(stay.name)}">${item.saved ? 'Saved' : 'Save'}</button></div>
        <div class="secondary"><button class="text-button reject">${item.rejected ? 'Restore' : 'Not for us'}</button></div>
        <details class="listing-details"><summary>More details</summary>
          <p><strong>Room or unit:</strong> ${escapeHtml(stay.unit || 'Not confirmed')}</p>
          <p><strong>Location:</strong> ${escapeHtml(stay.location)}</p>
          ${mappedWalk ? `<p>Walk measured from ${escapeHtml(route.origin)} to ${escapeHtml(route.destination)}, not from the room door. Step-free access is not confirmed.</p>` : ''}
          ${stay.tradeoffs.map(note => `<p>${escapeHtml(note)}</p>`).join('')}
          <p>${escapeHtml(quote.exclusions.length ? 'Extra charges: ' + quote.exclusions.join('; ') : quote.totalStatus === 'complete' ? 'The checked total includes the displayed taxes and fees.' : 'All taxes and fees have not been confirmed.')}</p>
          <p>Availability ${quoteMatches ? {available:'was checked with the price',request_to_book:'requires host approval',unavailable:'was unavailable when checked',unknown:'has not been confirmed'}[quote.availability] : 'has not been checked for your changed trip'}.</p>
          <h4>Sources</h4>${stay.evidence.map(evidence => `<p class="evidence-note"><a href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel(evidence))}</a>${evidence.checkedAt ? ' \u00b7 Reviewed ' + escapeHtml(displayDate(evidence.checkedAt)) : ''}<br>${escapeHtml(evidence.note)}</p>`).join('')}
        </details>
        <details class="notes"><summary>Notes${noteUnsaved ? ' (not saved)' : ''}</summary><label>Your thoughts<textarea aria-label="Notes for ${escapeHtml(stay.name)}" placeholder="Love the location. Ask about stairs."></textarea></label><p class="note-state" role="status">${noteUnsaved ? 'Not saved. Kept for this visit only.' : 'Saved automatically.'}</p></details>
      </div>`;
    }
    function adaptDataset(data) {
      const fail = message => { throw new Error(message); };
      const object = value => value && typeof value === 'object' && !Array.isArray(value);
      const text = value => typeof value === 'string' && value.length > 0;
      const states = ['yes','no','unknown'];
      const time = value => value === null || (text(value) && Number.isFinite(Date.parse(value)));
      if (!object(data) || data.schemaVersion !== '1.0' || !text(data.datasetId) || !text(data.createdAt) || !Number.isFinite(Date.parse(data.createdAt)) ||
          !object(data.trip) || !/^\d{4}-\d{2}-\d{2}$/.test(data.trip.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(data.trip.checkOut) ||
          !Number.isInteger(data.trip.adults) || data.trip.adults < 1 || data.trip.currency !== 'USD' ||
          !Array.isArray(data.candidates) || !Array.isArray(data.coverage)) fail('Expected a validated version 1.0 USD snapshot.');
      const nights = (Date.parse(data.trip.checkOut) - Date.parse(data.trip.checkIn)) / 86400000;
      if (new Date(data.trip.checkIn).toISOString().slice(0,10) !== data.trip.checkIn || new Date(data.trip.checkOut).toISOString().slice(0,10) !== data.trip.checkOut) fail('Trip dates are invalid.');
      if (!Number.isInteger(nights) || nights < 1 || nights !== data.trip.nights) fail('Trip dates and night count disagree.');
      if (!data.coverage.every(entry => object(entry) && text(entry.provider) && text(entry.status) && text(entry.details) &&
          (entry.url === undefined || (text(entry.url) && /^https:\/\/[^/\s]+(?:\/|$)/i.test(entry.url))))) fail('Source coverage is incomplete or has an invalid source link.');
      const ids = new Set();
      return data.candidates.map((candidate,index) => {
        const amenities = candidate.amenities;
        const quote = candidate.quote;
        const proximity = candidate.proximity;
        if (!object(candidate) || !text(candidate.id) || ids.has(candidate.id) || !text(candidate.name) || !text(candidate.provider) ||
            !Object.hasOwn(areaLabels,candidate.area) || !['hotel','entire_rental','private_room','unknown'].includes(candidate.type) ||
            !(candidate.unit === null || text(candidate.unit)) || !object(amenities) || !object(quote) || !object(proximity) ||
            !['full','kitchenette','none','unknown'].includes(amenities.kitchen) ||
            !['free','paid','none','unknown'].includes(amenities.parking) || !states.includes(amenities.stairs) ||
            !(amenities.bedrooms === null || (Number.isInteger(amenities.bedrooms) && amenities.bedrooms >= 0)) ||
            !states.includes(proximity.walkable) || !['verified_route','listing_claim','review_claim','location_only','unknown'].includes(proximity.basis) ||
            !(proximity.walkingMinutes === null || (typeof proximity.walkingMinutes === 'number' && Number.isFinite(proximity.walkingMinutes) && proximity.walkingMinutes >= 0)) ||
            ![proximity.origin,proximity.destination,proximity.description].every(value => value === null || text(value)) ||
            !['dated_quote','historical_quote','advertised_rate','not_verified','unavailable'].includes(quote.status) ||
            !(quote.amount === null || (typeof quote.amount === 'number' && Number.isFinite(quote.amount) && quote.amount >= 0)) ||
            !['complete','incomplete','unknown'].includes(quote.totalStatus) ||
            !['available','request_to_book','unavailable','unknown'].includes(quote.availability) ||
            !(quote.currency === null || (typeof quote.currency === 'string' && /^[A-Z]{3}$/.test(quote.currency))) ||
            !['whole_stay','nightly','unknown'].includes(quote.basis) || !time(quote.checkedAt) ||
            !Array.isArray(quote.exclusions) || !quote.exclusions.every(text) ||
            !Array.isArray(candidate.tradeoffs) || !candidate.tradeoffs.every(text) ||
            !Array.isArray(candidate.evidence) || !candidate.evidence.length || !candidate.evidence.every(item => object(item) && text(item.note) && text(item.url) && text(item.method) && text(item.scope) && Array.isArray(item.fields) && time(item.checkedAt))) fail(`Candidate ${index + 1} has missing or invalid fields.`);
        for (const machine of [amenities.washer,amenities.dryer]) {
          if (!object(machine) || !states.includes(machine.state) || !['in_unit','shared','off_site','unknown'].includes(machine.location)) fail(`Candidate ${index + 1} has invalid laundry details.`);
        }
        for (const value of [candidate.url,...candidate.evidence.map(item => item.url)]) {
          const url = new URL(value);
          if (url.protocol !== 'https:' || url.username || url.password) fail('Listing and evidence links must be HTTPS without credentials.');
        }
        if (['dated_quote','historical_quote'].includes(quote.status) &&
            (quote.amount === null || quote.basis !== 'whole_stay' || quote.checkIn !== data.trip.checkIn || quote.checkOut !== data.trip.checkOut ||
             quote.adults !== data.trip.adults || !candidate.unit || quote.unit !== candidate.unit)) fail(`Candidate ${index + 1} has a mismatched quote.`);
        if (['not_verified','unavailable'].includes(quote.status) && quote.amount !== null) fail('Unverified prices must be null, not zero.');
        if (quote.totalStatus === 'complete' && (!['dated_quote','historical_quote'].includes(quote.status) || quote.exclusions.length)) fail('Complete totals cannot contain unknown or excluded charges.');
        if (quote.status === 'dated_quote' && (!quote.checkedAt || !candidate.evidence.some(item => {
          const source = new URL(item.url), booking = new URL(candidate.url);
          return item.fields.includes('quote') && item.scope === 'unit' && ['listing_page','browser','api','user_supplied'].includes(item.method) &&
            item.checkedAt && Date.parse(item.checkedAt) === Date.parse(quote.checkedAt) && source.hostname === booking.hostname && source.pathname.replace(/\/$/,'') === booking.pathname.replace(/\/$/,'');
        }))) fail('Dated quotes need matching direct evidence and observation time.');
        if (proximity.walkingMinutes !== null && (proximity.basis !== 'verified_route' || !proximity.origin || !proximity.destination ||
            !candidate.evidence.some(item => item.fields.includes('walking') && item.scope === 'route' && item.method === 'route_tool'))) fail('Walking times need a checked route with identifiable endpoints.');
        ids.add(candidate.id);
        const type = {hotel:'Hotel',entire_rental:'Entire rental',private_room:'Private room',unknown:'Stay type unconfirmed'}[candidate.type];
        return {
          ...candidate, provider:providerLabels[candidate.provider] || candidate.provider,
          detail:[type,candidate.unit || 'Room/unit unconfirmed',amenities.bedrooms === null ? '' : `${amenities.bedrooms} bedrooms`].filter(Boolean).join(' / '),
          kitchen:amenities.kitchen === 'full',
          laundry:amenities.washer.state === 'yes' && amenities.dryer.state === 'yes' && amenities.washer.location === 'in_unit' && amenities.dryer.location === 'in_unit',
          location:proximity.description || 'No downtown walking evidence captured.',
          caution:candidate.tradeoffs.join(' '), cancel:'Cancellation: see evidence; recheck before booking',
          badge:areaLabels[candidate.area], color:candidate.type === 'hotel' ? '#cbdedb' : '#d8e8e0'
        };
      });
    }
    const storageKey = publishedView ? 'port-angeles-stays-choices-v1' : 'port-angeles-stay-mockup-v1';
    const unsavedNotes = new Set();
    let choices = Object.create(null);
    let view = 'all';
    let quoteMatches = true;
    const status = document.getElementById('status');
    const storageError = document.getElementById('storage-error');
    function showStorageError(message) {
      storageError.hidden = false;
      storageError.textContent = message;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid saved choices');
        for (const [id,item] of Object.entries(parsed)) {
          if (typeof item !== 'object' || typeof item.saved !== 'boolean' || typeof item.rejected !== 'boolean' || typeof item.note !== 'string') throw new Error('Invalid saved choice');
          choices[id] = { saved:item.saved, rejected:item.rejected, note:item.note };
        }
      }
    } catch (error) {
      showStorageError('Saved choices could not be loaded. Changes will work for this visit; existing stored data has not been cleared.');
    }
    function persist() {
      try { localStorage.setItem(storageKey, JSON.stringify(choices)); unsavedNotes.clear(); return true; }
      catch (error) { showStorageError('Your browser could not save these changes. Keep this page open; choices may be lost when you reload.'); return false; }
    }
    function choice(id) {
      if (!choices[id]) choices[id] = { saved:false, rejected:false, note:'' };
      return choices[id];
    }
    function wholeStayEstimate(stay) {
      if (importedDataset) {
        const quote = stay.quote;
        return quoteMatches && quote.status === 'dated_quote' && quote.basis === 'whole_stay' && quote.totalStatus === 'complete' &&
          quote.currency === 'USD' && quote.exclusions.length === 0 ? quote.amount : null;
      }
      return stay.provider === 'Booking.com' ? Math.round(stay.amount * 1.109 * 100) / 100 : stay.amount;
    }
    function bookingLink(stay) {
      const checkIn = document.getElementById('check-in');
      const checkOut = document.getElementById('check-out');
      if (!checkIn.checkValidity() || !checkOut.checkValidity() || checkOut.value <= checkIn.value) return null;
      const keys = stay.provider === 'Airbnb' ? ['check_in','check_out','adults']
        : stay.provider === 'Vrbo' ? ['chkin','chkout','adults'] : stay.provider === 'Booking.com' ? ['checkin','checkout','group_adults']
          : stay.provider === 'Port Angeles Inn (direct)' ? ['checkin','checkout','adults'] : null;
      const url = new URL(stay.url);
      if (!keys) return url.href;
      url.searchParams.set(keys[0],checkIn.value);
      url.searchParams.set(keys[1],checkOut.value);
      url.searchParams.set(keys[2],document.getElementById('guests').value);
      return url.href;
    }
    function filterMatch(stay,area,budget) {
      let unconfirmed = false;
      if (importedDataset) {
        const allowed = area === 0 ? ['downtown_port_angeles'] : area === 1 ? ['downtown_port_angeles','wider_port_angeles'] :
          area === 3 ? ['sequim'] : area === 4 ? ['joyce'] : area === 5 ? ['unknown'] : Object.keys(areaLabels);
        if (stay.area === 'unknown' && area !== 5) unconfirmed = true;
        else if (!allowed.includes(stay.area)) return 0;
        if (budget !== null) {
          const amount = wholeStayEstimate(stay);
          if (amount === null) unconfirmed = true;
          else if (amount > budget) return 0;
        }
        if (document.getElementById('kitchen').checked) {
          if (stay.amenities.kitchen === 'unknown') unconfirmed = true;
          else if (!stay.kitchen) return 0;
        }
        if (document.getElementById('laundry').checked) {
          const machines = [stay.amenities.washer,stay.amenities.dryer];
          if (machines.some(machine => machine.state === 'no' || (machine.state === 'yes' && ['shared','off_site'].includes(machine.location)))) return 0;
          if (!stay.laundry) unconfirmed = true;
        }
        return unconfirmed ? (document.getElementById('show-unknown').checked ? 1 : 0) : 2;
      }
      if (area === 0 && !downtownIds.has(stay.id)) return 0;
      if (budget !== null && wholeStayEstimate(stay) > budget) return 0;
      if (document.getElementById('kitchen').checked && !stay.kitchen) return 0;
      if (document.getElementById('laundry').checked && !stay.laundry) return 0;
      return 2;
    }
    function render() {
      const area = Number(document.getElementById('area').value);
      const areaName = document.getElementById('area').selectedOptions[0].textContent;
      const budgetInput = document.getElementById('budget');
      const budget = budgetInput.value !== '' && budgetInput.checkValidity() && quoteMatches ? budgetInput.valueAsNumber : null;
      document.getElementById('budget-help').textContent = !budgetInput.checkValidity()
        ? 'Enter a valid budget of zero or more dollars, with no more than two decimal places.'
        : !quoteMatches && budgetInput.value !== ''
          ? 'Budget filtering is paused: no matching quotes exist for the changed dates or guest count.'
          : importedDataset
            ? 'Budget matches require complete dated USD totals. Unpriced stays are unconfirmed, not free or within budget. No taxes are invented.'
            : 'Budget for all 7 nights, not per night. Hotel comparisons include the listed 10.9% tax estimate. Rental totals remain unverified; possible matches are not guaranteed to fit.';
      if (publishedView) document.getElementById('budget-help').textContent = !budgetInput.checkValidity() ? 'Enter a valid amount, with up to two decimal places.'
        : !quoteMatches ? 'Prices are not checked for this trip.' : 'For the whole trip. Places without a checked total may not fit.';
      document.getElementById('area-note').textContent = area === 0
        ? 'Downtown first. You choose whether to expand the area.'
        : area === 1
          ? 'Wider Port Angeles includes downtown. Other stays may require a drive; walking routes are not checked.'
          : importedDataset
            ? area === 2 ? 'Includes collected nearby-community leads and, if enabled, uncertain locations. This does not run a new search.'
              : area === 3 ? 'Sequim only; no driving or walking route is implied.'
                : area === 4 ? 'Joyce only. No reliably located Joyce candidate was captured in this pilot.'
                  : 'These leads cannot yet be assigned confidently to a captured area.'
            : 'Nearby communities may mean driving into downtown. This mockup has no nearby-community listings yet, so it still shows only the Port Angeles snapshots; no live search has run.';
      if (publishedView) document.getElementById('area-note').textContent = area === 0 ? '' : area === 1 ? 'Includes downtown and other Port Angeles neighborhoods.' : 'Some places may need a drive into town.';
      const sort = document.getElementById('sort').value;
      const priceSort = sort !== 'downtown' && quoteMatches;
      document.getElementById('sort-note').textContent = sort === 'downtown'
        ? 'Downtown group first. Exact walking distances are not checked.'
        : !quoteMatches
          ? 'Price sorting is paused: no matching quotes for these dates or guests. Showing downtown locations first instead.'
          : importedDataset
            ? 'Only complete dated USD totals can be price-sorted. Missing, incomplete and historical prices remain unconfirmed and sort after priced stays.'
            : 'Sorted by the displayed seven-night estimates. Rental final totals remain unverified.';
      if (publishedView) document.getElementById('sort-note').textContent = sort === 'downtown' ? '' : 'Places without a checked trip total come last.';
      const visible = stays.filter(stay => {
        const item = choice(stay.id);
        if (!filterMatch(stay,area,budget)) return false;
        return view === 'rejected' ? item.rejected : !item.rejected && (view !== 'saved' || item.saved);
      }).sort((a,b) => {
        if (priceSort) {
          const first = wholeStayEstimate(a), second = wholeStayEstimate(b);
          if (first === null && second !== null) return 1;
          if (second === null && first !== null) return -1;
          if (first !== null && second !== null) return (first - second) * (sort === 'price-asc' ? 1 : -1);
        }
        return Number(downtownIds.has(b.id)) - Number(downtownIds.has(a.id));
      });
      document.getElementById('saved-count').textContent = stays.filter(stay => choice(stay.id).saved && !choice(stay.id).rejected).length;
      document.getElementById('results-title').textContent = `${visible.length} ${visible.length === 1 ? 'place' : 'places'} ${view === 'saved' ? 'saved' : view === 'rejected' ? 'ruled out' : 'to explore'}.`;
      if (importedDataset) {
        const uncertain = visible.filter(stay => filterMatch(stay,area,budget) === 1).length;
        document.getElementById('results-sub').textContent = publishedView ? uncertain ? `${uncertain} ${uncertain === 1 ? 'place has' : 'places have'} details that still need checking.` : ''
          : `Snapshot trip: ${importedDataset.trip.checkIn} to ${importedDataset.trip.checkOut} / ${importedDataset.trip.nights} nights / ${importedDataset.trip.adults} adults. ${uncertain} shown with unconfirmed filter details.${quoteMatches ? '' : ' Changed trip: no matching quotes.'}`;
      }
      const cards = document.getElementById('cards');
      cards.replaceChildren();
      if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        const message = document.createElement('p');
        message.textContent = view === 'saved'
          ? 'No saved places match these filters. Visit All stays, or adjust your budget and area.'
          : view === 'rejected'
            ? 'No ruled-out places match these filters.'
            : budget !== null
              ? importedDataset ? `No evidenced budget match in ${areaName}. Missing prices are not proof that no affordable stays exist.` : `No snapshot matches your budget and preferences in ${areaName}. Comparisons use estimates, not verified live totals.`
              : `No snapshot matches your preferences in ${areaName}.`;
        empty.append(message);
        if (publishedView && view === 'all') message.textContent = budget !== null ? 'No confirmed matches. Other places may fit, but their prices need checking.' : 'No places match these filters.';
        if (view === 'all' && area < 2) {
          const explanation = document.createElement('p');
          explanation.textContent = 'Keep your dates, guest count, budget, kitchen, and laundry preferences. A broader area may require a drive; it does not guarantee savings.';
          if (publishedView) explanation.textContent = 'Try a wider area, or change your filters.';
          const expand = document.createElement('button');
          expand.className = 'primary';
          expand.type = 'button';
          expand.id = 'expand-area';
          expand.textContent = area === 0 ? 'Search wider Port Angeles' : 'Include nearby communities';
          if (publishedView) expand.textContent = area === 0 ? 'Show all Port Angeles' : 'Show nearby towns';
          expand.addEventListener('click', () => {
            document.getElementById('area').value = String(area + 1);
            status.textContent = 'Area expanded by your choice. All other preferences kept. This filters saved research, not a fresh provider search.';
            render();
            document.getElementById('area').focus();
          });
          empty.append(explanation,expand);
        } else if (view === 'all') {
          const explanation = document.createElement('p');
          explanation.textContent = importedDataset ? 'Only the loaded dataset is being filtered. You can include unconfirmed details or choose another area; no new availability search has run.' : 'This is the widest demo area. Nearby-community results are not connected. Try changing your budget or preferences; this is not proof that no affordable stays exist.';
          if (publishedView) explanation.textContent = 'Try changing your filters or including places with missing details.';
          empty.append(explanation);
        }
        cards.append(empty);
      }
      for (const stay of visible) {
        const item = choice(stay.id);
        const link = bookingLink(stay);
        const noteUnsaved = unsavedNotes.has(stay.id);
        const article = document.createElement('article');
        article.className = 'card';
        article.dataset.id = stay.id;
        article.style.setProperty('--scene',stay.color);
        const kitchenText = importedDataset ? {full:'Full kitchen (listed)',kitchenette:'Kitchenette (listed)',none:'No kitchen (listed)',unknown:'Kitchen unverified'}[stay.amenities.kitchen] : stay.kitchen ? 'Full kitchen' : 'Microwave + fridge';
        const machineText = (name,machine) => machine.state === 'unknown' ? `${name}: unverified` : machine.state === 'no' ? `${name}: not listed as available` :
          `${name}: listed / ${{in_unit:'in unit',shared:'shared',off_site:'off site',unknown:'location unverified'}[machine.location]}`;
        const laundryText = importedDataset ? `${machineText('Washer',stay.amenities.washer)}; ${machineText('dryer',stay.amenities.dryer)}` : stay.laundry ? 'Washer + dryer listed' : stay.id === 'craftsman' ? 'Laundry: verify dryer' : 'Laundry unconfirmed';
        const amountText = importedDataset ? !quoteMatches ? 'No matching quote' : stay.quote.amount === null ? 'Price not verified' :
          `${stay.quote.currency || 'Currency unverified'} ${stay.quote.amount.toLocaleString('en-US')}` : quoteMatches ? money.format(wholeStayEstimate(stay)) : 'No matching quote';
        const priceNote = importedDataset ? `${quoteMatches ? 'Availability recorded: ' + stay.quote.availability.replaceAll('_',' ') : 'Changed trip: availability not checked'}. Quote status: ${stay.quote.status.replaceAll('_',' ')}. Mandatory charges: ${stay.quote.totalStatus}.${stay.quote.checkedAt ? ' Price checked: ' + stay.quote.checkedAt + '.' : ' No dated price check captured.'} Recheck with the provider before booking.` : quoteMatches ? (stay.provider === 'Booking.com' ? 'Includes listed hotel tax estimate.' : 'Listed rental total; final taxes unverified.') + ' Nov 21, 2026 snapshot.' : 'No quote checked for your changed trip. Use the link below to check the selected dates.';
        const linkPreset = ['Airbnb','Vrbo','Booking.com','Port Angeles Inn (direct)'].includes(stay.provider);
        const travelText = importedDataset && stay.proximity.basis === 'verified_route' && stay.proximity.walkingMinutes !== null
          ? `${areaLabels[stay.area]} / checked map estimate: ${stay.proximity.walkingMinutes} min from ${stay.proximity.origin} to ${stay.proximity.destination}; not a step-free-access check`
          : `${importedDataset ? areaLabels[stay.area] : downtownIds.has(stay.id) ? 'Downtown' : 'Wider Port Angeles'} / walking access not checked`;
        const detailHtml = importedDataset ? `<details class="listing-details"><summary>Evidence and missing details</summary><p>${escapeHtml(stay.caution || 'No additional tradeoff recorded.')}</p><p>${escapeHtml(stay.quote.exclusions.length ? 'Excluded charges: ' + stay.quote.exclusions.join('; ') : 'No excluded charges recorded; this is not proof that all fees are included.')}</p>${stay.evidence.map(item => `<p class="evidence-note"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.method.replaceAll('_',' '))} / ${escapeHtml(item.scope)}</a>: ${escapeHtml(item.note)} ${item.checkedAt ? 'Observed ' + escapeHtml(item.checkedAt) : 'Observation time unknown'}.</p>`).join('')}</details>` : `<details class="listing-details"><summary>Price &amp; stay details</summary><p>${escapeHtml(stay.priceNote)} Original quote: Sep 15-22, 2027 for 2 guests.</p><p>${escapeHtml(stay.caution)}</p></details>`;
        article.innerHTML = publishedView ? publishedCardHtml(stay,item,link,noteUnsaved,filterMatch(stay,area,budget) === 1) : `
          <div class="visual" aria-hidden="true">
            <svg viewBox="0 0 350 142"><path d="M0 88 75 34 131 81 220 18 295 77 350 48V142H0Z" fill="#87a99a" opacity=".65"/><path d="M0 111Q160 93 350 115V142H0Z" fill="#639389"/><path d="M104 123V71H232V123Z" fill="#fcf6e8"/><path d="m92 73 77-43 77 43Z" fill="#365e52"/><path d="M119 82h24v23h-24zm39 0h24v23h-24zm40 0h20v41h-20z" fill="#a4bbb0"/><circle cx="295" cy="30" r="15" fill="#f3d99b"/></svg>
            <span class="badge">${escapeHtml(stay.badge)}</span>
          </div>
          <div class="body">
            <div class="provider">${escapeHtml(stay.provider)}</div>
            <h3>${escapeHtml(stay.name)}</h3><p class="description">${escapeHtml(stay.detail)}</p>
            <div class="features"><span class="feature ${stay.kitchen ? '' : 'partial'}">${escapeHtml(kitchenText)}</span><span class="feature ${stay.laundry ? '' : 'partial'}">${escapeHtml(laundryText)}</span></div>
            <p class="travel">${escapeHtml(travelText)}</p>
            <p class="location">${escapeHtml(stay.location)}</p><p class="caution">${escapeHtml(importedDataset ? stay.caution : accessNotes[stay.id])}</p>
            <div class="price"><span class="amount">${escapeHtml(amountText)}</span> <small>${importedDataset && quoteMatches && stay.quote.amount !== null ? escapeHtml(stay.quote.basis === 'whole_stay' ? '/ ' + importedDataset.trip.nights + '-night ' + (stay.quote.status === 'historical_quote' ? 'historical quote' : 'snapshot') : stay.quote.basis === 'nightly' ? '/ night (not a trip quote)' : '') : !importedDataset && quoteMatches ? '/ 7-night estimate' : ''}</small>
            <p class="price-note">${escapeHtml(priceNote)}</p></div>
            ${importedDataset && filterMatch(stay,area,budget) === 1 ? '<p class="budget-fit">Unconfirmed against one or more active filters; not a verified match.</p>' : budget !== null && !importedDataset ? `<p class="budget-fit">${stay.provider === 'Booking.com' ? 'Possible budget fit using listed tax estimate; final checkout may differ.' : 'Possible budget fit based on snapshot price; final total is unverified.'}</p>` : ''}
            <div class="actions">${link ? `<a class="listing" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="Check ${escapeHtml(stay.name)} on ${escapeHtml(stay.provider)} for selected trip dates">Check on ${escapeHtml(stay.provider)}</a>` : '<span class="listing" aria-disabled="true">Enter valid trip dates</span>'}<button class="save" aria-pressed="${item.saved}" aria-label="${item.saved ? 'Unsave' : 'Save'} ${escapeHtml(stay.name)}">${item.saved ? 'Saved here' : 'Save'}</button></div>
            <p class="link-context">${link ? linkPreset ? 'Booking link uses your selected dates and guest count. Opens another site; this does not confirm availability.' : 'Provider link does not preset dates or guests. Opens another site.' : 'Booking link unavailable until check-in and check-out dates are valid.'}</p>
            <div class="secondary"><span class="hint">${escapeHtml(quoteMatches ? stay.cancel : 'Cancellation: recheck')}</span><button class="text-button reject">${item.rejected ? 'Restore' : 'Not for us'}</button></div>
            ${detailHtml}
            <details class="notes"><summary>Your notes${item.note ? (noteUnsaved ? ' (not saved)' : ' (saved here)') : ''}</summary><label>What do you think?<textarea aria-label="Notes for ${escapeHtml(stay.name)}" placeholder="Love the location. Ask about stairs."></textarea></label><p class="note-state" role="status">${noteUnsaved ? 'Not saved to browser storage. Kept for this visit only.' : 'Notes save automatically in this browser.'}</p></details>
          </div>`;
        article.querySelector('textarea').value = item.note;
        article.querySelector('.save').addEventListener('click', () => {
          item.saved = !item.saved;
          const saved = persist();
          status.textContent = `${stay.name} ${item.saved ? 'saved' : 'removed from saved stays'}${saved ? ' in this browser.' : ' for this visit only.'}`;
          render();
        });
        article.querySelector('.reject').addEventListener('click', () => {
          item.rejected = !item.rejected;
          const saved = persist();
          status.textContent = `${stay.name} ${item.rejected ? 'moved to Not for us' : 'restored to All stays'}${saved ? '.' : ' for this visit only.'}`;
          render();
        });
        article.querySelector('textarea').addEventListener('input', () => {
          item.note = article.querySelector('textarea').value;
          const saved = persist();
          if (!saved) unsavedNotes.add(stay.id);
          article.querySelector('.notes summary').textContent = item.note ? (saved ? 'Your notes (saved here)' : 'Your notes (not saved)') : 'Your notes';
          article.querySelector('.note-state').textContent = saved ? 'Saved automatically in this browser.' : 'Not saved to browser storage. Kept for this visit only.';
        });
        cards.append(article);
      }
    }
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      view = tab.dataset.view;
      document.querySelectorAll('.tab').forEach(button => button.setAttribute('aria-pressed',String(button === tab)));
      render();
    }));
    ['kitchen','laundry','area','sort','show-unknown'].forEach(id => document.getElementById(id).addEventListener('change',render));
    document.getElementById('budget').addEventListener('input',render);
    function updateCriteria() {
      const checkIn = document.getElementById('check-in');
      const checkOut = document.getElementById('check-out');
      checkOut.setCustomValidity(checkOut.value && checkIn.value && checkOut.value <= checkIn.value ? 'Check-out must be after check-in.' : '');
      const criteriaError = document.getElementById('criteria-error');
      criteriaError.hidden = checkIn.checkValidity() && checkOut.checkValidity();
      criteriaError.textContent = 'Enter valid trip dates. Check-out must be after check-in; booking links are disabled until then.';
      const trip = importedDataset ? importedDataset.trip : {checkIn:'2027-09-15',checkOut:'2027-09-22',adults:2};
      quoteMatches = checkIn.value === trip.checkIn && checkOut.value === trip.checkOut && Number(document.getElementById('guests').value) === trip.adults;
      document.getElementById('results-sub').textContent = quoteMatches ? 'September 15-22, 2027 / 7 nights / 2 guests' : 'Changed trip / no matching quote / booking links use selected dates and guests';
      render();
    }
    ['check-in','check-out','guests'].forEach(id => document.getElementById(id).addEventListener('change',updateCriteria));
    function showDataset(data,adapted) {
      importedDataset = data;
      stays = adapted;
      downtownIds = data ? new Set(stays.filter(stay => stay.area === 'downtown_port_angeles').map(stay => stay.id)) : new Set(['harbor','redlion','inn']);
      if (!publishedView) document.getElementById('original-data').hidden = !data;
      document.getElementById('unknown-control').hidden = !data;
      document.querySelectorAll('[data-import-only]').forEach(option => { option.disabled = !data; option.hidden = !data; });
      document.getElementById('kitchen-label').textContent = data ? 'Full kitchen listed' : 'Full kitchen only';
      document.getElementById('laundry-label').textContent = data ? 'In-unit washer & dryer' : 'Washer & dryer listed';
      document.getElementById('area').value = data ? '2' : '0';
      if (publishedView) {
        const otherAreas = stays.some(stay => !['downtown_port_angeles','wider_port_angeles'].includes(stay.area));
        document.getElementById('area').value = '1';
        document.querySelector('#area option[value="2"]').hidden = !otherAreas;
        document.querySelectorAll('[data-import-only]').forEach(option => {
          const area = {3:'sequim',4:'joyce',5:'unknown'}[option.value];
          option.hidden = option.disabled = !stays.some(stay => stay.area === area);
        });
        document.getElementById('trip-summary').textContent = tripSummary(data.trip);
      }
      document.getElementById('check-in').value = data ? data.trip.checkIn : '2027-09-15';
      document.getElementById('check-out').value = data ? data.trip.checkOut : '2027-09-22';
      const guests = document.getElementById('guests');
      const adults = String(data ? data.trip.adults : 2);
      if (![...guests.options].some(option => option.value === adults)) guests.add(new Option(adults,adults));
      guests.value = adults;
      document.getElementById('demo').textContent = publishedView ? 'Prices and availability can change. Confirm with the property before booking.' : data ? 'Collected JSON preview / evidence-tagged snapshots / no live search or publication' : 'Clickable mockup / November 21, 2026 price snapshots. Search does not contact booking sites.';
      document.getElementById('dataset-note').textContent = publishedView ? `Research collected ${displayDate(data.createdAt)}. Partial collection, not every available stay. Listing details may be older.` : data ? `Loaded ${data.candidates.length} leads from snapshot ${data.datasetId}, collected ${data.createdAt}. Data stays in this view until reload; reselect the JSON then. Favorites and notes remain separate.` : 'Local preview only. Loading a file does not publish it or contact booking sites.';
      document.getElementById('source-title').textContent = publishedView ? 'Where we looked' : data ? `Source coverage: ${data.candidates.length} collected leads` : 'Search sources: 5 saved listing snapshots';
      document.getElementById('source-description').textContent = publishedView ? 'Details come from listings, property websites and maps. Open a place for its sources.' : data ? 'Saved research can include indexed claims and direct checks; see each listing and source for evidence and limits. This is not a live search; availability can change.' : 'No live sources are connected in this mockup.';
      const list = document.getElementById('source-list');
      list.replaceChildren();
      const coverage = data ? data.coverage : [
        {provider:'airbnb',details:'2 saved snapshots'}, {provider:'vrbo',details:'1 saved snapshot'},
        {provider:'booking',details:'2 saved snapshots'}, {provider:'Local managers',details:'not connected; no results included'}
      ];
      for (const entry of coverage) {
        const li = document.createElement('li');
        if (publishedView) {
          li.innerHTML = sourceCoverageHtml(entry);
        } else li.textContent = `${providerLabels[entry.provider] || entry.provider}: ${entry.status ? entry.status.replaceAll('_',' ') + '. ' : ''}${entry.details}`;
        list.append(li);
      }
      updateCriteria();
    }
    if (!publishedView) document.getElementById('dataset-file').addEventListener('change',async event => {
      const file = event.target.files[0];
      if (!file) return;
      const error = document.getElementById('dataset-error');
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('Snapshot exceeds the 5 MB preview limit.');
        const data = JSON.parse(await file.text());
        const adapted = adaptDataset(data);
        showDataset(data,adapted);
        error.hidden = true;
        status.textContent = `Loaded ${adapted.length} collected leads locally. Prices and availability were not refreshed; nothing was published.`;
      } catch (failure) {
        error.hidden = false;
        error.textContent = `Could not load this snapshot: ${failure.message}. The previous view was not replaced.`;
      }
    });
    if (!publishedView) document.getElementById('original-data').addEventListener('click',() => {
      showDataset(null,originalStays);
      document.getElementById('dataset-error').hidden = true;
      document.getElementById('dataset-file').value = '';
      status.textContent = 'Showing the original price snapshots again. Collected data and saved choices were not deleted.';
    });
    document.getElementById('search').addEventListener('submit',event => {
      event.preventDefault();
      updateCriteria();
      if (!event.currentTarget.reportValidity()) return;
      status.textContent = 'Filtered saved research only. No booking sites contacted, no new listings discovered and no prices refreshed.';
    });
    async function loadPublishedDataset() {
      const error = document.getElementById('dataset-error');
      const retry = document.getElementById('reload-data');
      const controls = document.querySelectorAll('#search input, #search select, #search button, .tab, #sort');
      controls.forEach(control => { control.disabled = true; });
      retry.disabled = true;
      error.hidden = true;
      status.textContent = 'Loading places...';
      try {
        const response = await fetch('data/current.json',{cache:'no-store'});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        if (content.length > 5 * 1024 * 1024) throw new Error('Snapshot exceeds the 5 MB limit');
        const data = JSON.parse(content);
        const adapted = adaptDataset(data);
        showDataset(data,adapted);
        controls.forEach(control => { control.disabled = false; });
        retry.hidden = true;
        status.textContent = `${adapted.length} places loaded.`;
      } catch (failure) {
        error.textContent = `Places could not be loaded: ${failure.message}. Try again, or return later.`;
        error.hidden = false;
        retry.hidden = false;
        status.textContent = 'Places are unavailable until loading succeeds.';
      } finally {
        retry.disabled = false;
      }
    }
    if (publishedView) {
      document.getElementById('reload-data').addEventListener('click',loadPublishedDataset);
      loadPublishedDataset();
    } else {
      render();
    }
