// <nowiki>


(function($) {


/*
 ****************************************
 *** twinklefluff.js: Revert/rollback module
 ****************************************
 * Mode of invocation:     Links on contributions, recent changes, history, and diff pages
 * Active on:              Diff pages, history pages, Special:RecentChanges(Linked),
                           and Special:Contributions
 */

/**
 Twinklefluff revert and antivandalism utility
 */

Twinkle.fluff = function twinklefluff() {
	// A list of usernames, usually only bots, that vandalism revert is jumped over; that is,
	// if vandalism revert was chosen on such username, then its target is on the revision before.
	// This is for handling quick bots that makes edits seconds after the original edit is made.
	// This only affects vandalism rollback; for good faith rollback, it will stop, indicating a bot
	// has no faith, and for normal rollback, it will rollback that edit.
	Twinkle.fluff.whiteList = [
		'AnomieBOT',
		'SineBot'
	];

	if (mw.util.getParamValue('twinklerevert')) {
		// Return if the user can't edit the page in question
		if (!mw.config.get('wgIsProbablyEditable')) {
			alert("Unable to edit the page, it's probably protected.");
		} else {
			Twinkle.fluff.auto();
		}
	} else if (mw.config.get('wgCanonicalSpecialPageName') === 'Contributions') {
		Twinkle.fluff.addLinks.contributions();
	} else if (mw.config.get('wgCanonicalSpecialPageName') === 'Recentchanges' || mw.config.get('wgCanonicalSpecialPageName') === 'Recentchangeslinked') {
		// Reload with recent changes updates
		// structuredChangeFilters.ui.initialized is just on load
		mw.hook('wikipage.content').add(function(item) {
			if (item.is('div')) {
				Twinkle.fluff.addLinks.recentchanges();
			}
		});
	} else if (mw.config.get('wgIsProbablyEditable')) {
		// Only proceed if the user can actually edit the page
		// in question (ignored for contributions, see #632).
		// wgIsProbablyEditable should take care of
		// namespace/contentModel restrictions as well as
		// explicit protections; it won't take care of
		// cascading or TitleBlacklist restrictions
		if (mw.config.get('wgDiffNewId') || mw.config.get('wgDiffOldId')) { // wgDiffOldId included for clarity in if else loop [[phab:T214985]]
			mw.hook('wikipage.diff').add(function () { // Reload alongside the revision slider
				Twinkle.fluff.addLinks.diff();
			});
		} else if (mw.config.get('wgAction') === 'view' && mw.config.get('wgCurRevisionId') !== mw.config.get('wgRevisionId')) {
			Twinkle.fluff.addLinks.oldid();
		} else if (mw.config.get('wgAction') === 'history') {
			Twinkle.fluff.addLinks.history();
		}
	}
};


Twinkle.fluff.spanTag = function twinklefluffspanTag(color, content) {
	var span = document.createElement('span');
	span.style.color = color;
	span.appendChild(document.createTextNode(content));
	return span;
};

Twinkle.fluff.buildLink = function twinklefluffbuildLink(color, text) {
	var link = document.createElement('a');
	link.appendChild(Twinkle.fluff.spanTag('Black', '['));
	link.appendChild(Twinkle.fluff.spanTag(color, text));
	link.appendChild(Twinkle.fluff.spanTag('Black', ']'));
	return link;
};

// Build [restore this revision] links
Twinkle.fluff.restoreThisRevision = function (element, revType) {
	var revertToRevision = document.createElement('div');
	revertToRevision.setAttribute('id', 'tw-revert-to-' + (revType === 'wgDiffNewId' ? 'n' : 'o') + 'revision');
	revertToRevision.style.fontWeight = 'bold';

	var revertToRevisionLink = Twinkle.fluff.buildLink('SaddleBrown', 'restore this version');
	revertToRevisionLink.href = '#';
	$(revertToRevisionLink).click(function() {
		Twinkle.fluff.revertToRevision(mw.config.get(revType).toString());
	});
	revertToRevision.appendChild(revertToRevisionLink);

	var title = document.getElementById(element).parentNode;
	title.insertBefore(revertToRevision, title.firstChild);
};


Twinkle.fluff.auto = function twinklefluffauto() {
	if (parseInt(mw.util.getParamValue('oldid', $('#mw-diff-ntitle1 a:first').attr('href')), 10) !== mw.config.get('wgCurRevisionId')) {
		// not latest revision
		alert("Can't rollback, page has changed in the meantime.");
		return;
	}

	var vandal = $('#mw-diff-ntitle2').find('a.mw-userlink').text();

	Twinkle.fluff.revert(mw.util.getParamValue('twinklerevert'), vandal, true);
};

Twinkle.fluff.addLinks = {
	contributions: function() {
		// $('sp-contributions-footer-anon-range') relies on the fmbox
		// id in [[MediaWiki:Sp-contributions-footer-anon-range]] and
		// is used to show rollback/vandalism links for IP ranges
		if (mw.config.exists('wgRelevantUserName') || !!$('#sp-contributions-footer-anon-range')[0]) {
			// Get the username these contributions are for
			var username = mw.config.get('wgRelevantUserName');
			if (Twinkle.getPref('showRollbackLinks').indexOf('contribs') !== -1 ||
				(mw.config.get('wgUserName') !== username && Twinkle.getPref('showRollbackLinks').indexOf('others') !== -1) ||
				(mw.config.get('wgUserName') === username && Twinkle.getPref('showRollbackLinks').indexOf('mine') !== -1)) {
				var list = $('#mw-content-text').find('ul li:has(span.mw-uctop):has(.mw-changeslist-diff)');

				var revNode = document.createElement('strong');
				var revLink = Twinkle.fluff.buildLink('SteelBlue', 'rollback');
				revNode.appendChild(revLink);

				var revVandNode = document.createElement('strong');
				var revVandLink = Twinkle.fluff.buildLink('Red', 'vandalism');
				revVandNode.appendChild(revVandLink);

				list.each(function(key, current) {
					var href = $(current).find('.mw-changeslist-diff').attr('href');
					current.appendChild(document.createTextNode(' '));
					var tmpNode = revNode.cloneNode(true);
					tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=norm');
					current.appendChild(tmpNode);
					current.appendChild(document.createTextNode(' '));
					tmpNode = revVandNode.cloneNode(true);
					tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=vand');
					current.appendChild(tmpNode);
				});
			}
		}
	},

	recentchanges: function() {
		if (Twinkle.getPref('showRollbackLinks').indexOf('recent') !== -1) {
			// Latest and revertable (not page creations, logs, categorizations, etc.)
			var list = $('.mw-changeslist .mw-changeslist-last.mw-changeslist-src-mw-edit');
			// Exclude top-level header if "group changes" preference is used
			// and find only individual lines or nested lines
			list = list.not('.mw-rcfilters-ui-highlights-enhanced-toplevel').find('.mw-changeslist-line-inner, td.mw-enhanced-rc-nested');

			var revNode = document.createElement('strong');
			var revLink = Twinkle.fluff.buildLink('SteelBlue', 'rollback');
			revNode.appendChild(revLink);

			var revVandNode = document.createElement('strong');
			var revVandLink = Twinkle.fluff.buildLink('Red', 'vandalism');
			revVandNode.appendChild(revVandLink);

			list.each(function(key, current) {
				current.appendChild(document.createTextNode(' '));
				var href = $(current).find('.mw-changeslist-diff').attr('href');
				var tmpNode = revNode.cloneNode(true);
				tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=norm');
				current.appendChild(tmpNode);
				current.appendChild(document.createTextNode(' '));
				tmpNode = revVandNode.cloneNode(true);
				tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=vand');
				current.appendChild(tmpNode);
			});
		}
	},

	history: function() {
		if (Twinkle.getPref('showRollbackLinks').indexOf('history') !== -1) {
			// All revs
			var histList = $('#pagehistory li').toArray();

			// On first page of results, so add revert/rollback
			// links to the top revision
			if (!$('.mw-firstlink').length) {
				var first = histList.shift();
				var vandal = first.querySelector('.mw-userlink').text;

				var agfNode = document.createElement('strong');
				var vandNode = document.createElement('strong');
				var normNode = document.createElement('strong');

				var agfLink = Twinkle.fluff.buildLink('DarkOliveGreen', 'rollback (AGF)');
				var vandLink = Twinkle.fluff.buildLink('Red', 'rollback (VANDAL)');
				var normLink = Twinkle.fluff.buildLink('SteelBlue', 'rollback');

				agfLink.href = '#';
				vandLink.href = '#';
				normLink.href = '#';
				$(agfLink).click(function() {
					Twinkle.fluff.revert('agf', vandal);
				});
				$(vandLink).click(function() {
					Twinkle.fluff.revert('vand', vandal);
				});
				$(normLink).click(function() {
					Twinkle.fluff.revert('norm', vandal);
				});

				agfNode.appendChild(agfLink);
				vandNode.appendChild(vandLink);
				normNode.appendChild(normLink);

				first.appendChild(document.createTextNode(' '));
				first.appendChild(agfNode);
				first.appendChild(document.createTextNode(' '));
				first.appendChild(normNode);
				first.appendChild(document.createTextNode(' '));
				first.appendChild(vandNode);
			}

			// oldid
			histList.forEach(function(rev) {
				// From restoreThisRevision, non-transferable

				var href = rev.querySelector('.mw-changeslist-date').href;
				var oldid = parseInt(mw.util.getParamValue('oldid', href), 10);

				var revertToRevisionNode = document.createElement('strong');
				var revertToRevisionLink = Twinkle.fluff.buildLink('SaddleBrown', 'restore this version');

				revertToRevisionLink.href = '#';
				$(revertToRevisionLink).click(function() {
					Twinkle.fluff.revertToRevision(oldid.toString());
				});
				revertToRevisionNode.appendChild(revertToRevisionLink);

				rev.appendChild(document.createTextNode(' '));
				rev.appendChild(revertToRevisionNode);
			});


		}
	},

	diff: function() {
		// Autofill user talk links on diffs with vanarticle for easy warning, but don't autowarn
		var warnFromTalk = function(xtitle) {
			var talkLink = $('#mw-diff-' + xtitle + '2 .mw-usertoollinks a').first();
			if (talkLink.length) {
				var extraParams = 'vanarticle=' + mw.util.rawurlencode(Morebits.pageNameNorm) + '&' + 'noautowarn=true';
				// diffIDs for vanarticlerevid
				extraParams += '&vanarticlerevid=';
				extraParams += xtitle === 'otitle' ? mw.config.get('wgDiffOldId') : mw.config.get('wgDiffNewId');

				var href = talkLink.attr('href');
				if (href.indexOf('?') === -1) {
					talkLink.attr('href', href + '?' + extraParams);
				} else {
					talkLink.attr('href', href + '&' + extraParams);
				}
			}
		};

		// Older revision
		warnFromTalk('otitle'); // Add quick-warn link to user talk link
		// Don't load if there's a single revision or weird diff (cur on latest)
		if (mw.config.get('wgDiffOldId') && (mw.config.get('wgDiffOldId') !== mw.config.get('wgDiffNewId'))) {
			// Add a [restore this revision] link to the older revision
			Twinkle.fluff.restoreThisRevision('mw-diff-otitle1', 'wgDiffOldId');
		}

		// Newer revision
		warnFromTalk('ntitle'); // Add quick-warn link to user talk link
		// Add either restore or rollback links to the newer revision
		// Don't show if there's a single revision or weird diff (prev on first)
		if (document.getElementById('differences-nextlink')) {
			// Not latest revision, add [restore this revision] link to newer revision
			Twinkle.fluff.restoreThisRevision('mw-diff-ntitle1', 'wgDiffNewId');
		} else if (Twinkle.getPref('showRollbackLinks').indexOf('diff') !== -1 && mw.config.get('wgDiffOldId') && (mw.config.get('wgDiffOldId') !== mw.config.get('wgDiffNewId') || document.getElementById('differences-prevlink'))) {
			var vandal = $('#mw-diff-ntitle2').find('a').first().text();

			var revertNode = document.createElement('div');
			revertNode.setAttribute('id', 'tw-revert');

			var agfNode = document.createElement('strong');
			var vandNode = document.createElement('strong');
			var normNode = document.createElement('strong');

			var agfLink = Twinkle.fluff.buildLink('DarkOliveGreen', 'rollback (AGF)');
			var vandLink = Twinkle.fluff.buildLink('Red', 'rollback (VANDAL)');
			var normLink = Twinkle.fluff.buildLink('SteelBlue', 'rollback');

			agfLink.href = '#';
			vandLink.href = '#';
			normLink.href = '#';
			$(agfLink).click(function() {
				Twinkle.fluff.revert('agf', vandal);
			});
			$(vandLink).click(function() {
				Twinkle.fluff.revert('vand', vandal);
			});
			$(normLink).click(function() {
				Twinkle.fluff.revert('norm', vandal);
			});

			agfNode.appendChild(agfLink);
			vandNode.appendChild(vandLink);
			normNode.appendChild(normLink);

			revertNode.appendChild(agfNode);
			revertNode.appendChild(document.createTextNode(' || '));
			revertNode.appendChild(normNode);
			revertNode.appendChild(document.createTextNode(' || '));
			revertNode.appendChild(vandNode);

			var ntitle = document.getElementById('mw-diff-ntitle1').parentNode;
			ntitle.insertBefore(revertNode, ntitle.firstChild);
		}
	},

	oldid: function() { // Add a [restore this revision] link on old revisions
		Twinkle.fluff.restoreThisRevision('mw-revision-info', 'wgRevisionId');
	}
};


Twinkle.fluff.revert = function revertPage(type, vandal, autoRevert, rev, page) {
	if (mw.util.isIPv6Address(vandal)) {
		vandal = Morebits.sanitizeIPv6(vandal);
	}

	var pagename = page || mw.config.get('wgPageName');
	var revid = rev || mw.config.get('wgCurRevisionId');

	Morebits.status.init(document.getElementById('mw-content-text'));
	$('#catlinks').remove();

	var params = {
		type: type,
		user: vandal,
		pagename: pagename,
		revid: revid,
		autoRevert: !!autoRevert
	};
	var query = {
		'action': 'query',
		'prop': ['info', 'revisions', 'flagged'],
		'titles': pagename,
		'rvlimit': 50, // intentionally limited
		'rvprop': [ 'ids', 'timestamp', 'user', 'comment' ],
		'curtimestamp': '',
		'meta': 'tokens',
		'type': 'csrf'
	};
	var wikipedia_api = new Morebits.wiki.api('Grabbing data of earlier revisions', query, Twinkle.fluff.callbacks.main);
	wikipedia_api.params = params;
	wikipedia_api.post();
};

Twinkle.fluff.revertToRevision = function revertToRevision(oldrev) {

	Morebits.status.init(document.getElementById('mw-content-text'));

	var query = {
		'action': 'query',
		'prop': ['info', 'revisions'],
		'titles': mw.config.get('wgPageName'),
		'rvlimit': 1,
		'rvstartid': oldrev,
		'rvprop': [ 'ids', 'timestamp', 'user', 'comment' ],
		'format': 'xml',
		'curtimestamp': '',
		'meta': 'tokens',
		'type': 'csrf'
	};
	var wikipedia_api = new Morebits.wiki.api('Grabbing data of the earlier revision', query, Twinkle.fluff.callbacks.toRevision.main);
	wikipedia_api.params = { rev: oldrev };
	wikipedia_api.post();
};

Twinkle.fluff.userIpLink = function(user) {
	return (mw.util.isIPAddress(user) ? '[[Special:Contributions/' : '[[:User:') + user + '|' + user + ']]';
};

Twinkle.fluff.callbacks = {
	toRevision: {
		main: function(self) {
			var xmlDoc = self.responseXML;

			var lastrevid = parseInt($(xmlDoc).find('page').attr('lastrevid'), 10);
			var touched = $(xmlDoc).find('page').attr('touched');
			var loadtimestamp = $(xmlDoc).find('api').attr('curtimestamp');
			var csrftoken = $(xmlDoc).find('tokens').attr('csrftoken');
			var revertToRevID = $(xmlDoc).find('rev').attr('revid');
			var revertToUser = $(xmlDoc).find('rev').attr('user');

			if (revertToRevID !== self.params.rev) {
				self.statelem.error('The retrieved revision does not match the requested revision. Stopping revert.');
				return;
			}

			var optional_summary = prompt('Please specify a reason for the revert:                                ', '');  // padded out to widen prompt in Firefox
			if (optional_summary === null) {
				self.statelem.error('Aborted by user.');
				return;
			}
			var summary = Twinkle.fluff.formatSummary('Reverted to revision ' + revertToRevID + ' by $USER', revertToUser, optional_summary);

			var query = {
				'action': 'edit',
				'title': mw.config.get('wgPageName'),
				'summary': summary,
				'token': csrftoken,
				'undo': lastrevid,
				'undoafter': revertToRevID,
				'basetimestamp': touched,
				'starttimestamp': loadtimestamp,
				'watchlist': Twinkle.getPref('watchRevertedPages').indexOf('torev') !== -1 ? 'watch' : undefined,
				'minor': Twinkle.getPref('markRevertedPagesAsMinor').indexOf('torev') !== -1 ? true : undefined
			};

			Morebits.wiki.actionCompleted.redirect = mw.config.get('wgPageName');
			Morebits.wiki.actionCompleted.notice = 'Reversion completed';

			var wikipedia_api = new Morebits.wiki.api('Saving reverted contents', query, Twinkle.fluff.callbacks.complete, self.statelem);
			wikipedia_api.params = self.params;
			wikipedia_api.post();

		}
	},
	main: function(self) {
		var xmlDoc = self.responseXML;

		var lastrevid = parseInt($(xmlDoc).find('page').attr('lastrevid'), 10);
		var touched = $(xmlDoc).find('page').attr('touched');
		var loadtimestamp = $(xmlDoc).find('api').attr('curtimestamp');
		var csrftoken = $(xmlDoc).find('tokens').attr('csrftoken');
		var lastuser = $(xmlDoc).find('rev').attr('user');

		var revs = $(xmlDoc).find('rev');

		if (revs.length < 1) {
			self.statelem.error('We have less than one additional revision, thus impossible to revert.');
			return;
		}
		var top = revs[0];
		if (lastrevid < self.params.revid) {
			Morebits.status.error('Error', [ 'The most recent revision ID received from the server, ', Morebits.htmlNode('strong', lastrevid), ', is less than the ID of the displayed revision. This could indicate that the current revision has been deleted, the server is lagging, or that bad data has been received. Stopping revert.' ]);
			return;
		}
		var index = 1;
		if (self.params.revid !== lastrevid) {
			Morebits.status.warn('Warning', [ 'Latest revision ', Morebits.htmlNode('strong', lastrevid), ' doesn\'t equal our revision ', Morebits.htmlNode('strong', self.params.revid) ]);
			if (lastuser === self.params.user) {
				switch (self.params.type) {
					case 'vand':
						Morebits.status.info('Info', [ 'Latest revision was made by ', Morebits.htmlNode('strong', self.params.user), '. As we assume vandalism, we will proceed to revert.' ]);
						break;
					case 'agf':
						Morebits.status.warn('Warning', [ 'Latest revision was made by ', Morebits.htmlNode('strong', self.params.user), '. As we assume good faith, we will stop the revert, as the problem might have been fixed.' ]);
						return;
					default:
						Morebits.status.warn('Notice', [ 'Latest revision was made by ', Morebits.htmlNode('strong', self.params.user), ', but we will stop the revert.' ]);
						return;
				}
			} else if (self.params.type === 'vand' &&
					Twinkle.fluff.whiteList.indexOf(top.getAttribute('user')) !== -1 && revs.length > 1 &&
					revs[1].getAttribute('pageId') === self.params.revid) {
				Morebits.status.info('Info', [ 'Latest revision was made by ', Morebits.htmlNode('strong', lastuser), ', a trusted bot, and the revision before was made by our vandal, so we will proceed with the revert.' ]);
				index = 2;
			} else {
				Morebits.status.error('Error', [ 'Latest revision was made by ', Morebits.htmlNode('strong', lastuser), ', so it might have already been reverted, we will stop the revert.']);
				return;
			}

		}

		if (Twinkle.fluff.whiteList.indexOf(self.params.user) !== -1) {
			switch (self.params.type) {
				case 'vand':
					Morebits.status.info('Info', [ 'Vandalism revert was chosen on ', Morebits.htmlNode('strong', self.params.user), '. As this is a whitelisted bot, we assume you wanted to revert vandalism made by the previous user instead.' ]);
					index = 2;
					self.params.user = revs[1].getAttribute('user');
					break;
				case 'agf':
					Morebits.status.warn('Notice', [ 'Good faith revert was chosen on ', Morebits.htmlNode('strong', self.params.user), '. This is a whitelisted bot and thus AGF rollback will not proceed.' ]);
					return;
				case 'norm':
				/* falls through */
				default:
					var cont = confirm('Normal revert was chosen, but the most recent edit was made by a whitelisted bot (' + self.params.user + '). Do you want to revert the revision before instead?');
					if (cont) {
						Morebits.status.info('Info', [ 'Normal revert was chosen on ', Morebits.htmlNode('strong', self.params.user), '. This is a whitelisted bot, and per confirmation, we\'ll revert the previous revision instead.' ]);
						index = 2;
						self.params.user = revs[1].getAttribute('user');
					} else {
						Morebits.status.warn('Notice', [ 'Normal revert was chosen on ', Morebits.htmlNode('strong', self.params.user), '. This is a whitelisted bot, but per confirmation, revert on selected revision will proceed.' ]);
					}
					break;
			}
		}
		var found = false;
		var count = 0;

		for (var i = index; i < revs.length; ++i) {
			++count;
			if (revs[i].getAttribute('user') !== self.params.user) {
				found = i;
				break;
			}
		}

		if (!found) {
			self.statelem.error([ 'No previous revision found. Perhaps ', Morebits.htmlNode('strong', self.params.user), ' is the only contributor, or that the user has made more than ' + Twinkle.getPref('revertMaxRevisions') + ' edits in a row.' ]);
			return;
		}

		if (!count) {
			Morebits.status.error('Error', 'As it is not possible to revert zero revisions, we will stop this revert. It could be that the edit has already been reverted, but the revision ID was still the same.');
			return;
		}

		var good_revision = revs[found];
		var userHasAlreadyConfirmedAction = false;
		if (self.params.type !== 'vand' && count > 1) {
			if (!confirm(self.params.user + ' has made ' + count + ' edits in a row. Are you sure you want to revert them all?')) {
				Morebits.status.info('Notice', 'Stopping revert.');
				return;
			}
			userHasAlreadyConfirmedAction = true;
		}

		self.params.count = count;

		self.params.goodid = good_revision.getAttribute('revid');
		self.params.gooduser = good_revision.getAttribute('user');

		self.statelem.status([ ' revision ', Morebits.htmlNode('strong', self.params.goodid), ' that was made ', Morebits.htmlNode('strong', count), ' revisions ago by ', Morebits.htmlNode('strong', self.params.gooduser) ]);

		var summary, extra_summary;
		switch (self.params.type) {
			case 'agf':
				extra_summary = prompt('An optional comment for the edit summary:                              ', '');  // padded out to widen prompt in Firefox
				if (extra_summary === null) {
					self.statelem.error('Aborted by user.');
					return;
				}
				userHasAlreadyConfirmedAction = true;

				summary = Twinkle.fluff.formatSummary('Reverted [[WP:AGF|good faith]] edits by $USER', self.params.user, extra_summary);
				break;

			case 'vand':

				summary = 'Reverted ' + self.params.count + (self.params.count > 1 ? ' edits' : ' edit') + ' by [[Special:Contributions/' +
				self.params.user + '|' + self.params.user + ']] ([[User talk:' + self.params.user + '|talk]]) to last revision by ' +
				self.params.gooduser + Twinkle.getPref('summaryAd');
				break;

			case 'norm':
			/* falls through */
			default:
				if (Twinkle.getPref('offerReasonOnNormalRevert')) {
					extra_summary = prompt('An optional comment for the edit summary:                              ', '');  // padded out to widen prompt in Firefox
					if (extra_summary === null) {
						self.statelem.error('Aborted by user.');
						return;
					}
					userHasAlreadyConfirmedAction = true;
				}

				summary = Twinkle.fluff.formatSummary('Reverted ' + self.params.count + (self.params.count > 1 ? ' edits' : ' edit') +
				' by $USER', self.params.user, extra_summary);
				break;
		}

		if (Twinkle.getPref('confirmOnFluff') && !userHasAlreadyConfirmedAction && !confirm('Reverting page: are you sure?')) {
			self.statelem.error('Aborted by user.');
			return;
		}

		var query;
		if ((!self.params.autoRevert || Twinkle.getPref('openTalkPageOnAutoRevert')) &&
				Twinkle.getPref('openTalkPage').indexOf(self.params.type) !== -1 &&
				mw.config.get('wgUserName') !== self.params.user) {
			Morebits.status.info('Info', [ 'Opening user talk page edit form for user ', Morebits.htmlNode('strong', self.params.user) ]);

			query = {
				'title': 'User talk:' + self.params.user,
				'action': 'edit',
				'preview': 'yes',
				'vanarticle': self.params.pagename.replace(/_/g, ' '),
				'vanarticlerevid': self.params.revid,
				'vanarticlegoodrevid': self.params.goodid,
				'type': self.params.type,
				'count': self.params.count
			};

			switch (Twinkle.getPref('userTalkPageMode')) {
				case 'tab':
					window.open(mw.util.getUrl('', query), '_blank');
					break;
				case 'blank':
					window.open(mw.util.getUrl('', query), '_blank',
						'location=no,toolbar=no,status=no,directories=no,scrollbars=yes,width=1200,height=800');
					break;
				case 'window':
				/* falls through */
				default:
					window.open(mw.util.getUrl('', query),
						window.name === 'twinklewarnwindow' ? '_blank' : 'twinklewarnwindow',
						'location=no,toolbar=no,status=no,directories=no,scrollbars=yes,width=1200,height=800');
					break;
			}
		}

		// figure out whether we need to/can review the edit
		var $flagged = $(xmlDoc).find('flagged');
		if ((Morebits.userIsInGroup('reviewer') || Morebits.userIsSysop) &&
				$flagged.length &&
				$flagged.attr('stable_revid') >= self.params.goodid &&
				$flagged.attr('pending_since')) {
			self.params.reviewRevert = true;
			self.params.csrftoken = csrftoken;
		}

		query = {
			'action': 'edit',
			'title': self.params.pagename,
			'summary': summary,
			'token': csrftoken,
			'undo': lastrevid,
			'undoafter': self.params.goodid,
			'basetimestamp': touched,
			'starttimestamp': loadtimestamp,
			'watchlist': Twinkle.getPref('watchRevertedPages').indexOf(self.params.type) !== -1 ? 'watch' : undefined,
			'minor': Twinkle.getPref('markRevertedPagesAsMinor').indexOf(self.params.type) !== -1 ? true : undefined
		};

		Morebits.wiki.actionCompleted.redirect = self.params.pagename;
		Morebits.wiki.actionCompleted.notice = 'Reversion completed';

		var wikipedia_api = new Morebits.wiki.api('Saving reverted contents', query, Twinkle.fluff.callbacks.complete, self.statelem);
		wikipedia_api.params = self.params;
		wikipedia_api.post();

	},
	complete: function (apiobj) {
		// TODO Most of this is copy-pasted from Morebits.wiki.page#fnSaveSuccess. Unify it
		var xml = apiobj.getXML();
		var $edit = $(xml).find('edit');

		if ($(xml).find('captcha').length > 0) {
			apiobj.statelem.error('Could not rollback, because the wiki server wanted you to fill out a CAPTCHA.');
		} else if ($edit.attr('nochange') === '') {
			apiobj.statelem.error('Revision we are reverting to is identical to current revision, stopping revert.');
		} else {
			apiobj.statelem.info('done');

			// review the revert, if needed
			if (apiobj.params.reviewRevert) {
				var query = {
					'action': 'review',
					'revid': $edit.attr('newrevid'),
					'token': apiobj.params.csrftoken,
					'comment': Twinkle.getPref('summaryAd').trim()
				};
				var wikipedia_api = new Morebits.wiki.api('Automatically accepting your changes', query);
				wikipedia_api.post();
			}
		}
	}
};

// builtInString should contain the string "$USER", which will be replaced
// by an appropriate user link
Twinkle.fluff.formatSummary = function(builtInString, userName, userString) {
	var result = builtInString;

	// append user's custom reason
	if (userString) {
		result += ': ' + Morebits.string.toUpperCaseFirstChar(userString);
	}
	result += Twinkle.getPref('summaryAd');

	// find number of UTF-8 bytes the resulting string takes up, and possibly add
	// a contributions or contributions+talk link if it doesn't push the edit summary
	// over the 255-byte limit
	var resultLen = unescape(encodeURIComponent(result.replace('$USER', ''))).length;
	var contribsLink = '[[Special:Contributions/' + userName + '|' + userName + ']]';
	var contribsLen = unescape(encodeURIComponent(contribsLink)).length;
	if (resultLen + contribsLen <= 255) {
		var talkLink = ' ([[User talk:' + userName + '|talk]])';
		if (resultLen + contribsLen + unescape(encodeURIComponent(talkLink)).length <= 255) {
			result = Morebits.string.safeReplace(result, '$USER', contribsLink + talkLink);
		} else {
			result = Morebits.string.safeReplace(result, '$USER', contribsLink);
		}
	} else {
		result = Morebits.string.safeReplace(result, '$USER', userName);
	}

	return result;
};
})(jQuery);


// </nowiki>
