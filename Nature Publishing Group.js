{
	"translatorID": "6614a99-479a-4524-8e30-686e4d66663e",
	"label": "Nature Publishing Group",
	"creator": "Aurimas Vinckevicius",
	"target": "https?://[^/]*nature\\.com(:[\\d]+)?(?=/)[^?]*(/(journal|archive|research|topten|search|full|abs)/|/current_issue.htm|/most.htm)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2012-06-30 10:38:44"
}

/**
	Copyright (c) 2012 Aurimas Vinckevicius
	
	This program is free software: you can redistribute it and/or
	modify it under the terms of the GNU Affero General Public License
	as published by the Free Software Foundation, either version 3 of
	the License, or (at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
	Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public
	License along with this program. If not, see
	<http://www.gnu.org/licenses/>.
*/

//unescape Highwire's special html characters
function unescape(str) {
	if(!str || str.indexOf('[') == -1) return str;

	return str.replace(/\|?\[([^\]]+)\]\|?/g, function(s, p1) {
		if(ISO8879CharMap[p1] !== undefined) {
		  return ISO8879CharMap[p1];
		} else {
		  return s;
		}
  	});
}

//fix capitalization if all in upper case
function fixCaps(str) {
	if (str && str == str.toUpperCase()) {
		return ZU.capitalizeTitle(str.toLowerCase(), true);
	} else {
		return str;
	}
}

//get abstract
function getAbstract(doc) {
	var abstractLocations = [
	//e.g. 'lead' http://www.nature.com/emboj/journal/v31/n1/full/emboj2011343a.html
	//e.g. 'first_paragraph' http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj201239a.html
	'//p[contains(@class,"lead") or contains(@class,"first_paragraph")]',
	//e.g.
	'//div[@id="abs"]/*[self::div[not(contains(@class, "keyw-abbr"))] or self::p]',
	//e.g. 'first-paragraph' http://www.nature.com/nature/journal/v481/n7381/full/nature10669.html
	//e.g. 'standfirst' http://www.nature.com/nature/journal/v481/n7381/full/481237a.html
	'//div[@id="first-paragraph" or @class="standfirst"]/p',
	//e.g. http://www.nature.com/nature/journal/v481/n7381/full/nature10728.html
	'//div[contains(@id,"abstract")]/div[@class="content"]/p'];

	var paragraphs = [];

	for (var i = 0, n = abstractLocations.length; i < n && !paragraphs.length; i++) {
		paragraphs = Zotero.Utilities.xpath(doc, abstractLocations[i]);
	}

	if (!paragraphs.length) return null;

	var textArr = new Array();
	var p;
	for (var i = 0, n = paragraphs.length; i < n; i++) {
		//remove superscript references
		p = ZU.xpathText(paragraphs[i], "./node()[not(self::sup and ./a)]", null, '');
		if(p) p = ZU.trimInternal(p);
		if(p) textArr.push(p);
	}

	return textArr.join("\n").trim() || null;
}

//some journals display keywords
function getKeywords(doc) {
	var keywords = Zotero.Utilities.xpathText(doc, '//p[@class="keywords"]') || //e.g. http://www.nature.com/onc/journal/v26/n6/full/1209842a.html
	Zotero.Utilities.xpathText(doc, '//ul[@class="keywords"]//ul/li', null, '') || //e.g. http://www.nature.com/emboj/journal/v31/n3/full/emboj2011459a.html
	Zotero.Utilities.xpathText(doc, '//div[contains(@class,"article-keywords")]/ul/li/a', null, '; '); //e.g. http://www.nature.com/nature/journal/v481/n7382/full/481433a.html
	if (!keywords) return null;
	return keywords.split(/[;,]\s+/);
}

//get PDF url
function getPdfUrl(url) {
	var m = url.match(/(^[^#?]+\/)(?:full|abs)(\/[^#?]+?\.)[a-zA-Z]+(?=$|\?|#)/);
	if (m && m.length) return m[1] + 'pdf' + m[2] + 'pdf';
}

//add using embedded metadata
function scrapeEmbedMeta(doc, url) {
	var translator = Zotero.loadTranslator("web");
	//Embedded Metadata translator
	translator.setTranslator("951c027d-74ac-47d4-a107-9c3069ab7b48");

	translator.setDocument(doc);

	translator.setHandler("itemDone", function (obj, item) {
		//Replace HTML special characters with proper characters
		//also remove all caps in Names and Titles
		for (i in item.creators) {
			item.creators[i].lastName = unescape(item.creators[i].lastName);
			item.creators[i].firstName = unescape(item.creators[i].firstName);

			item.creators[i].lastName = fixCaps(item.creators[i].lastName);
			item.creators[i].firstName = fixCaps(item.creators[i].firstName);
		}

		item.title = fixCaps(unescape(item.title));
		item.abstractNote = unescape(item.abstractNote);

		//the date in EM is usually online publication date
		//If we can find a publication year, that's better
		var year = ZU.xpathText(doc,
			'//dd[preceding-sibling::dt[1][text()="Year published:" or text()="Date published:"]]');
		if(year && ( year = year.match(/\(\s*(.*?)\s*\)/) )) {
			item.date = year[1];
		} else if( (year = ZU.xpathText(doc,'//p[@id="cite"]')) &&
			(year = year.match(/\((\d{4})\)/)) ) {
			item.date = year[1];
		} else if(
			(year = ZU.xpathText(doc, '//a[contains(@href,"publicationDate")]/@href')) &&
			(year = year.match(/publicationDate=([^&]+)/)) &&
			//check that we at least have a year
			year[1].match(/\d{4}/)) {
			item.date = year[1];
		}

		//sometimes abstract from EM is description for the website.
		//ours should always be better
		var abstract = getAbstract(doc);
		if (abstract
			//maybe the abstract from meta tags is more complete
			&& !(item.abstractNote
				&& item.abstractNote.substr(0,10) == abstract.substr(0,10)
				&& item.abstractNote.length > abstract.length)) {
			item.abstractNote = abstract;
		}

		var pdf = getPdfUrl(url);
		if (pdf) {
			item.attachments = [{
				url: pdf,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			}];
		}

		if (!item.tags || item.tags.length < 1) item.tags = getKeywords(doc);

		if (item.notes) item.notes = [];

		item.complete();
	});

	translator.translate();
}

function detectWeb(doc, url) {
	if (url.match(/\/(full|abs)\/[^\/]+($|\?|#)/)) {

		return 'journalArticle';

	} else if (doc.title.toLowerCase().indexOf('table of contents') != -1 || //single issue ToC. e.g. http://www.nature.com/emboj/journal/v30/n1/index.html or http://www.nature.com/nature/journal/v481/n7381/index.html
	doc.title.toLowerCase().indexOf('current issue') != -1 || url.indexOf('/research/') != -1 || url.indexOf('/topten/') != -1 || url.indexOf('/most.htm') != -1 || (url.indexOf('/vaop/') != -1 && url.indexOf('index.html') != -1) || //advanced online publication
	url.indexOf('sp-q=') != -1) { //search query
		return 'multiple';

	} else if (url.indexOf('/archive/') != -1) {
		if (url.indexOf('index.htm') != -1) return false; //list of issues
		if (url.indexOf('subject.htm') != -1) return false; //list of subjects
		if (url.indexOf('category.htm') != -1 && url.indexOf('code=') == -1) return false; //list of categories
		return 'multiple'; //all else should be ok
	}
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		var allHNodes = '*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5]';
		var nodex, titlex, linkx;
		var nodes = [];

		if (url.indexOf('/search/') != -1 || url.indexOf('/most.htm') != -1) {
			//search, "top" lists
			nodex = '//ol[@class="results-list" or @id="content-list"]/li';
			titlex = './' + allHNodes + '/node()[not(self::span)]';
			linkx = './' + allHNodes + '/a';

			nodes = Zotero.Utilities.xpath(doc, nodex);
		} else {

			//Maybe there's a nice way to figure out which journal uses what style, but for now we'll just try one until it matches
			//these seem to be listed in order of frequency
			var styles = [
			//oncogene
			{
				'nodex': '//div[child::*[@class="atl"]]',
				'titlex': './' + allHNodes + '/node()[not(self::span)]',
				'linkx': './p[@class="links"]/a[contains(text(),"Full Text") or contains(text(),"Full text")]'
			},
			//embo journal
			{
				'nodex': '//ul[@class="articles"]/li',
				'titlex': './' + allHNodes + '[@class="article-title"]/node()[not(self::span)]',
				'linkx': './ul[@class="article-links"]/li/a[contains(text(),"Full Text") or contains(text(),"Full text")]'
			},
			//nature
			{
				'nodex': '//ul[contains(@class,"article-list") or contains(@class,"collapsed-list")]/li',
				'titlex': './/' + allHNodes + '/a',
				'linkx': './/' + allHNodes + '/a'
			}];

			for (var i = 0; i < styles.length && nodes.length == 0; i++) {
				nodex = styles[i].nodex;
				titlex = styles[i].titlex;
				linkx = styles[i].linkx;

				nodes = Zotero.Utilities.xpath(doc, nodex);
			}
		}

		if (nodes.length == 0) return false; //nothing matched
		var items = new Object();
		var title, url;
		for (var i = 0; i < nodes.length; i++) {
			title = Zotero.Utilities.xpathText(nodes[i], titlex, null, '');
			link = Zotero.Utilities.xpath(nodes[i], linkx);
			if (title && link.length == 1) {
				items[link[0].href] = title.trim();
			}
		}

		var urls = new Array();

		Zotero.selectItems(items, function (selectedItems) {
			if (selectedItems == null) return true;
			for (var item in selectedItems) {
				urls.push(item);
			}
			Zotero.Utilities.processDocuments(urls, function (newDoc) {
				doWeb(newDoc, newDoc.location.href)
			}, function () {
				Zotero.done();
			});
			Zotero.wait();
		});
	} else {
		scrapeEmbedMeta(doc, url);
	}
}

//ISO8879 to unicode character map
var ISO8879CharMap = {
  "excl":"\u0021", "quot":"\u0022", "num":"\u0023", "dollar":"\u0024",
  "percnt":"\u0025", "amp":"\u0026", "apos":"\u0027", "lpar":"\u0028",
  "rpar":"\u0029", "ast":"\u002A", "plus":"\u002B", "comma":"\u002C",
  "period":"\u002E", "sol":"\u002F", "colon":"\u003A", "semi":"\u003B",
  "lt":"\u003C", "equals":"\u003D", "gt":"\u003E", "quest":"\u003F",
  "commat":"\u0040", "lsqb":"\u005B", "lbrack":"\u005B", "bsol":"\u005C",
  "rsqb":"\u005D", "rbrack":"\u005D", "lowbar":"\u005F", "grave":"\u0060",
  "DiacriticalGrave":"\u0060", "jnodot":"\u006A", "lcub":"\u007B", "lbrace":"\u007B",
  "verbar":"\u007C", "vert":"\u007C", "rcub":"\u007D", "rbrace":"\u007D",
  "nbsp":"\u00A0", "NonBreakingSpace":"\u00A0", "iexcl":"\u00A1", "cent":"\u00A2",
  "pound":"\u00A3", "curren":"\u00A4", "yen":"\u00A5", "brvbar":"\u00A6",
  "sect":"\u00A7", "die":"\u00A8", "uml":"\u00A8", "die":"\u00A8",
  "uml":"\u00A8", "copy":"\u00A9", "ordf":"\u00AA", "laquo":"\u00AB",
  "not":"\u00AC", "shy":"\u00AD", "reg":"\u00AE", "circledR":"\u00AE",
  "macr":"\u00AF", "deg":"\u00B0", "plusmn":"\u00B1", "pm":"\u00B1",
  "PlusMinus":"\u00B1", "sup2":"\u00B2", "sup3":"\u00B3", "acute":"\u00B4",
  "DiacriticalAcute":"\u00B4", "micro":"\u00B5", "para":"\u00B6", "middot":"\u00B7",
  "centerdot":"\u00B7", "CenterDot":"\u00B7", "cedil":"\u00B8", "Cedilla":"\u00B8",
  "sup1":"\u00B9", "ordm":"\u00BA", "raquo":"\u00BB", "frac14":"\u00BC",
  "frac12":"\u00BD", "half":"\u00BD", "frac12":"\u00BD", "half":"\u00BD",
  "frac34":"\u00BE", "iquest":"\u00BF", "Agrave":"\u00C0", "Aacute":"\u00C1",
  "Acirc":"\u00C2", "Atilde":"\u00C3", "Auml":"\u00C4", "Aring":"\u00C5",
  "AElig":"\u00C6", "Ccedil":"\u00C7", "Egrave":"\u00C8", "Eacute":"\u00C9",
  "Ecirc":"\u00CA", "Euml":"\u00CB", "Igrave":"\u00CC", "Iacute":"\u00CD",
  "Icirc":"\u00CE", "Iuml":"\u00CF", "ETH":"\u00D0", "Ntilde":"\u00D1",
  "Ograve":"\u00D2", "Oacute":"\u00D3", "Ocirc":"\u00D4", "Otilde":"\u00D5",
  "Ouml":"\u00D6", "times":"\u00D7", "Oslash":"\u00D8", "Ugrave":"\u00D9",
  "Uacute":"\u00DA", "Ucirc":"\u00DB", "Uuml":"\u00DC", "Yacute":"\u00DD",
  "THORN":"\u00DE", "szlig":"\u00DF", "agrave":"\u00E0", "aacute":"\u00E1",
  "acirc":"\u00E2", "atilde":"\u00E3", "auml":"\u00E4", "aring":"\u00E5",
  "aelig":"\u00E6", "ccedil":"\u00E7", "egrave":"\u00E8", "eacute":"\u00E9",
  "ecirc":"\u00EA", "euml":"\u00EB", "igrave":"\u00EC", "iacute":"\u00ED",
  "icirc":"\u00EE", "iuml":"\u00EF", "eth":"\u00F0", "ntilde":"\u00F1",
  "ograve":"\u00F2", "oacute":"\u00F3", "ocirc":"\u00F4", "otilde":"\u00F5",
  "ouml":"\u00F6", "divide":"\u00F7", "div":"\u00F7", "oslash":"\u00F8",
  "ugrave":"\u00F9", "uacute":"\u00FA", "ucirc":"\u00FB", "uuml":"\u00FC",
  "yacute":"\u00FD", "thorn":"\u00FE", "yuml":"\u00FF", "Amacr":"\u0100",
  "amacr":"\u0101", "Abreve":"\u0102", "abreve":"\u0103", "Aogon":"\u0104",
  "aogon":"\u0105", "Cacute":"\u0106", "cacute":"\u0107", "Ccirc":"\u0108",
  "ccirc":"\u0109", "Cdot":"\u010A", "cdot":"\u010B", "Ccaron":"\u010C",
  "ccaron":"\u010D", "Dcaron":"\u010E", "dcaron":"\u010F", "Dstrok":"\u0110",
  "dstrok":"\u0111", "Emacr":"\u0112", "emacr":"\u0113", "Edot":"\u0116",
  "edot":"\u0117", "Eogon":"\u0118", "eogon":"\u0119", "Ecaron":"\u011A",
  "ecaron":"\u011B", "Gcirc":"\u011C", "gcirc":"\u011D", "Gbreve":"\u011E",
  "gbreve":"\u011F", "Gdot":"\u0120", "gdot":"\u0121", "Gcedil":"\u0122",
  "Hcirc":"\u0124", "hcirc":"\u0125", "Hstrok":"\u0126", "hstrok":"\u0127",
  "Itilde":"\u0128", "itilde":"\u0129", "Imacr":"\u012A", "imacr":"\u012B",
  "Iogon":"\u012E", "iogon":"\u012F", "Idot":"\u0130", "IJlig":"\u0132",
  "ijlig":"\u0133", "Jcirc":"\u0134", "jcirc":"\u0135", "Kcedil":"\u0136",
  "kcedil":"\u0137", "kgreen":"\u0138", "Lacute":"\u0139", "lacute":"\u013A",
  "Lcedil":"\u013B", "lcedil":"\u013C", "Lcaron":"\u013D", "lcaron":"\u013E",
  "Lmidot":"\u013F", "lmidot":"\u0140", "Lstrok":"\u0141", "lstrok":"\u0142",
  "Nacute":"\u0143", "nacute":"\u0144", "Ncedil":"\u0145", "ncedil":"\u0146",
  "Ncaron":"\u0147", "ncaron":"\u0148", "napos":"\u0149", "ENG":"\u014A",
  "eng":"\u014B", "Omacr":"\u014C", "omacr":"\u014D", "Odblac":"\u0150",
  "odblac":"\u0151", "OElig":"\u0152", "oelig":"\u0153", "Racute":"\u0154",
  "racute":"\u0155", "Rcedil":"\u0156", "rcedil":"\u0157", "Rcaron":"\u0158",
  "rcaron":"\u0159", "Sacute":"\u015A", "sacute":"\u015B", "Scirc":"\u015C",
  "scirc":"\u015D", "Scedil":"\u015E", "scedil":"\u015F", "Scaron":"\u0160",
  "scaron":"\u0161", "Tcedil":"\u0162", "tcedil":"\u0163", "Tcaron":"\u0164",
  "tcaron":"\u0165", "Tstrok":"\u0166", "tstrok":"\u0167", "Utilde":"\u0168",
  "utilde":"\u0169", "Umacr":"\u016A", "umacr":"\u016B", "Ubreve":"\u016C",
  "ubreve":"\u016D", "Uring":"\u016E", "uring":"\u016F", "Udblac":"\u0170",
  "udblac":"\u0171", "Uogon":"\u0172", "uogon":"\u0173", "Wcirc":"\u0174",
  "wcirc":"\u0175", "Ycirc":"\u0176", "ycirc":"\u0177", "Yuml":"\u0178",
  "Zacute":"\u0179", "zacute":"\u017A", "Zdot":"\u017B", "zdot":"\u017C",
  "Zcaron":"\u017D", "zcaron":"\u017E", "gacute":"\u01F5", "circ":"\u02C6",
  "caron":"\u02C7", "Hacek":"\u02C7", "breve":"\u02D8", "Breve":"\u02D8",
  "dot":"\u02D9", "DiacriticalDot":"\u02D9", "ring":"\u02DA", "ogon":"\u02DB",
  "tilde":"\u02DC", "DiacriticalTilde":"\u02DC", "dblac":"\u02DD", "DiacriticalDoubleAcute":"\u02DD",
  "Aacgr":"\u0386", "Eacgr":"\u0388", "EEacgr":"\u0389", "Iacgr":"\u038A",
  "Oacgr":"\u038C", "Uacgr":"\u038E", "OHacgr":"\u038F", "idiagr":"\u0390",
  "Agr":"\u0391", "Bgr":"\u0392", "Ggr":"\u0393", "Gamma":"\u0393",
  "Dgr":"\u0394", "Delta":"\u0394", "Egr":"\u0395", "Zgr":"\u0396",
  "EEgr":"\u0397", "THgr":"\u0398", "Theta":"\u0398", "Igr":"\u0399",
  "Kgr":"\u039A", "Lgr":"\u039B", "Lambda":"\u039B", "Mgr":"\u039C",
  "Ngr":"\u039D", "Xgr":"\u039E", "Xi":"\u039E", "Ogr":"\u039F",
  "Pgr":"\u03A0", "Pi":"\u03A0", "Rgr":"\u03A1", "Sgr":"\u03A3",
  "Sigma":"\u03A3", "Tgr":"\u03A4", "Ugr":"\u03A5", "PHgr":"\u03A6",
  "Phi":"\u03A6", "KHgr":"\u03A7", "PSgr":"\u03A8", "Psi":"\u03A8",
  "OHgr":"\u03A9", "Omega":"\u03A9", "Idigr":"\u03AA", "Udigr":"\u03AB",
  "aacgr":"\u03AC", "eacgr":"\u03AD", "eeacgr":"\u03AE", "iacgr":"\u03AF",
  "udiagr":"\u03B0", "agr":"\u03B1", "alpha":"\u03B1", "bgr":"\u03B2",
  "beta":"\u03B2", "ggr":"\u03B3", "gamma":"\u03B3", "dgr":"\u03B4",
  "delta":"\u03B4", "egr":"\u03B5", "epsiv":"\u03B5", "zgr":"\u03B6",
  "zeta":"\u03B6", "eegr":"\u03B7", "eta":"\u03B7", "thgr":"\u03B8",
  "thetas":"\u03B8", "igr":"\u03B9", "iota":"\u03B9", "kgr":"\u03BA",
  "kappa":"\u03BA", "lgr":"\u03BB", "lambda":"\u03BB", "mgr":"\u03BC",
  "mu":"\u03BC", "ngr":"\u03BD", "nu":"\u03BD", "xgr":"\u03BE",
  "xi":"\u03BE", "ogr":"\u03BF", "pgr":"\u03C0", "pi":"\u03C0",
  "rgr":"\u03C1", "rho":"\u03C1", "sfgr":"\u03C2", "sigmav":"\u03C2",
  "sgr":"\u03C3", "sigma":"\u03C3", "tgr":"\u03C4", "tau":"\u03C4",
  "ugr":"\u03C5", "upsi":"\u03C5", "phgr":"\u03C6", "phiv":"\u03C6",
  "khgr":"\u03C7", "chi":"\u03C7", "psgr":"\u03C8", "psi":"\u03C8",
  "ohgr":"\u03C9", "omega":"\u03C9", "idigr":"\u03CA", "udigr":"\u03CB",
  "oacgr":"\u03CC", "uacgr":"\u03CD", "ohacgr":"\u03CE", "thetav":"\u03D1",
  "vartheta":"\u03D1", "Upsi":"\u03D2", "phis":"\u03D5", "straightphi":"\u03D5",
  "piv":"\u03D6", "varpi":"\u03D6", "b.Gammad":"\u03DC", "gammad":"\u03DD",
  "b.gammad":"\u03DD", "kappav":"\u03F0", "varkappa":"\u03F0", "rhov":"\u03F1",
  "varrho":"\u03F1", "epsi":"\u03F5", "epsis":"\u03F5", "epsi":"\u03F5",
  "straightepsilon":"\u03F5", "epsis":"\u03F5", "straightepsilon":"\u03F5", "bepsi":"\u03F6",
  "backepsilon":"\u03F6", "IOcy":"\u0401", "DJcy":"\u0402", "GJcy":"\u0403",
  "Jukcy":"\u0404", "DScy":"\u0405", "Iukcy":"\u0406", "YIcy":"\u0407",
  "Jsercy":"\u0408", "LJcy":"\u0409", "NJcy":"\u040A", "TSHcy":"\u040B",
  "KJcy":"\u040C", "Ubrcy":"\u040E", "DZcy":"\u040F", "Acy":"\u0410",
  "Bcy":"\u0411", "Vcy":"\u0412", "Gcy":"\u0413", "Dcy":"\u0414",
  "IEcy":"\u0415", "ZHcy":"\u0416", "Zcy":"\u0417", "Icy":"\u0418",
  "Jcy":"\u0419", "Kcy":"\u041A", "Lcy":"\u041B", "Mcy":"\u041C",
  "Ncy":"\u041D", "Ocy":"\u041E", "Pcy":"\u041F", "Rcy":"\u0420",
  "Scy":"\u0421", "Tcy":"\u0422", "Ucy":"\u0423", "Fcy":"\u0424",
  "KHcy":"\u0425", "TScy":"\u0426", "CHcy":"\u0427", "SHcy":"\u0428",
  "SHCHcy":"\u0429", "HARDcy":"\u042A", "Ycy":"\u042B", "SOFTcy":"\u042C",
  "Ecy":"\u042D", "YUcy":"\u042E", "YAcy":"\u042F", "acy":"\u0430",
  "bcy":"\u0431", "vcy":"\u0432", "gcy":"\u0433", "dcy":"\u0434",
  "iecy":"\u0435", "zhcy":"\u0436", "zcy":"\u0437", "icy":"\u0438",
  "jcy":"\u0439", "kcy":"\u043A", "lcy":"\u043B", "mcy":"\u043C",
  "ncy":"\u043D", "ocy":"\u043E", "pcy":"\u043F", "rcy":"\u0440",
  "scy":"\u0441", "tcy":"\u0442", "ucy":"\u0443", "fcy":"\u0444",
  "khcy":"\u0445", "tscy":"\u0446", "chcy":"\u0447", "shcy":"\u0448",
  "shchcy":"\u0449", "hardcy":"\u044A", "ycy":"\u044B", "softcy":"\u044C",
  "ecy":"\u044D", "yucy":"\u044E", "yacy":"\u044F", "iocy":"\u0451",
  "djcy":"\u0452", "gjcy":"\u0453", "jukcy":"\u0454", "dscy":"\u0455",
  "iukcy":"\u0456", "yicy":"\u0457", "jsercy":"\u0458", "ljcy":"\u0459",
  "njcy":"\u045A", "tshcy":"\u045B", "kjcy":"\u045C", "ubrcy":"\u045E",
  "dzcy":"\u045F", "ensp":"\u2002", "emsp":"\u2003", "emsp13":"\u2004",
  "emsp14":"\u2005", "numsp":"\u2007", "puncsp":"\u2008", "thinsp":"\u2009",
  "ThinSpace":"\u2009", "hairsp":"\u200A", "VeryThinSpace":"\u200A", "hyphen":"\u2010",
  "dash":"\u2010", "ndash":"\u2013", "mdash":"\u2014", "horbar":"\u2015",
  "lsquo":"\u2018", "OpenCurlyQuote":"\u2018", "rsquo":"\u2019", "rsquor":"\u2019",
  "lsquor":"\u201A", "ldquo":"\u201C", "OpenCurlyDoubleQuote":"\u201C", "rdquo":"\u201D",
  "rdquor":"\u201D", "ldquor":"\u201E", "dagger":"\u2020", "Dagger":"\u2021",
  "ddagger":"\u2021", "bull":"\u2022", "bullet":"\u2022", "nldr":"\u2025",
  "hellip":"\u2026", "mldr":"\u2026", "hellip":"\u2026", "mldr":"\u2026",
  "vprime":"\u2032", "bprime":"\u2035", "backprime":"\u2035", "caret":"\u2041",
  "hybull":"\u2043", "incare":"\u2105", "planck":"\u210F", "hbar":"\u210F",
  "hslash":"\u210F", "ell":"\u2113", "numero":"\u2116", "copysr":"\u2117",
  "weierp":"\u2118", "wp":"\u2118", "real":"\u211C", "Re":"\u211C",
  "realpart":"\u211C", "rx":"\u211E", "trade":"\u2122", "ohm":"\u2126",
  "beth":"\u2136", "gimel":"\u2137", "daleth":"\u2138", "frac13":"\u2153",
  "frac23":"\u2154", "frac15":"\u2155", "frac25":"\u2156", "frac35":"\u2157",
  "frac45":"\u2158", "frac16":"\u2159", "frac56":"\u215A", "frac18":"\u215B",
  "frac38":"\u215C", "frac58":"\u215D", "frac78":"\u215E", "larr":"\u2190",
  "leftarrow":"\u2190", "LeftArrow":"\u2190", "ShortLeftArrow":"\u2190", "uarr":"\u2191",
  "uparrow":"\u2191", "UpArrow":"\u2191", "ShortUpArrow":"\u2191", "rarr":"\u2192",
  "rightarrow":"\u2192", "RightArrow":"\u2192", "ShortRightArrow":"\u2192", "darr":"\u2193",
  "downarrow":"\u2193", "DownArrow":"\u2193", "ShortDownArrow":"\u2193", "harr":"\u2194",
  "leftrightarrow":"\u2194", "LeftRightArrow":"\u2194", "varr":"\u2195", "updownarrow":"\u2195",
  "UpDownArrow":"\u2195", "nwarr":"\u2196", "UpperLeftArrow":"\u2196", "nwarrow":"\u2196",
  "nearr":"\u2197", "UpperRightArrow":"\u2197", "nearrow":"\u2197", "drarr":"\u2198",
  "searrow":"\u2198", "LowerRightArrow":"\u2198", "dlarr":"\u2199", "swarrow":"\u2199",
  "LowerLeftArrow":"\u2199", "nlarr":"\u219A", "nleftarrow":"\u219A", "nrarr":"\u219B",
  "nrightarrow":"\u219B", "rarrw":"\u219D", "rightsquigarrow":"\u219D", "Larr":"\u219E",
  "twoheadleftarrow":"\u219E", "Rarr":"\u21A0", "twoheadrightarrow":"\u21A0", "larrtl":"\u21A2",
  "leftarrowtail":"\u21A2", "rarrtl":"\u21A3", "rightarrowtail":"\u21A3", "map":"\u21A6",
  "RightTeeArrow":"\u21A6", "mapsto":"\u21A6", "larrhk":"\u21A9", "hookleftarrow":"\u21A9",
  "rarrhk":"\u21AA", "hookrightarrow":"\u21AA", "larrlp":"\u21AB", "looparrowleft":"\u21AB",
  "rarrlp":"\u21AC", "looparrowright":"\u21AC", "harrw":"\u21AD", "leftrightsquigarrow":"\u21AD",
  "nharr":"\u21AE", "nleftrightarrow":"\u21AE", "lsh":"\u21B0", "Lsh":"\u21B0",
  "rsh":"\u21B1", "Rsh":"\u21B1", "cularr":"\u21B6", "curvearrowleft":"\u21B6",
  "curarr":"\u21B7", "curvearrowright":"\u21B7", "olarr":"\u21BA", "circlearrowleft":"\u21BA",
  "orarr":"\u21BB", "circlearrowright":"\u21BB", "lharu":"\u21BC", "LeftVector":"\u21BC",
  "leftharpoonup":"\u21BC", "lhard":"\u21BD", "leftharpoondown":"\u21BD", "DownLeftVector":"\u21BD",
  "uharr":"\u21BE", "upharpoonright":"\u21BE", "RightUpVector":"\u21BE", "uharl":"\u21BF",
  "upharpoonleft":"\u21BF", "LeftUpVector":"\u21BF", "rharu":"\u21C0", "RightVector":"\u21C0",
  "rightharpoonup":"\u21C0", "rhard":"\u21C1", "rightharpoondown":"\u21C1", "DownRightVector":"\u21C1",
  "dharr":"\u21C2", "RightDownVector":"\u21C2", "downharpoonright":"\u21C2", "dharl":"\u21C3",
  "LeftDownVector":"\u21C3", "downharpoonleft":"\u21C3", "rlarr2":"\u21C4", "rightleftarrows":"\u21C4",
  "RightArrowLeftArrow":"\u21C4", "lrarr2":"\u21C6", "leftrightarrows":"\u21C6", "LeftArrowRightArrow":"\u21C6",
  "larr2":"\u21C7", "leftleftarrows":"\u21C7", "uarr2":"\u21C8", "upuparrows":"\u21C8",
  "rarr2":"\u21C9", "rightrightarrows":"\u21C9", "darr2":"\u21CA", "downdownarrows":"\u21CA",
  "lrhar2":"\u21CB", "ReverseEquilibrium":"\u21CB", "leftrightharpoons":"\u21CB", "rlhar2":"\u21CC",
  "rightleftharpoons":"\u21CC", "Equilibrium":"\u21CC", "nlArr":"\u21CD", "nLeftarrow":"\u21CD",
  "nhArr":"\u21CE", "nLeftrightarrow":"\u21CE", "nrArr":"\u21CF", "nRightarrow":"\u21CF",
  "uArr":"\u21D1", "Uparrow":"\u21D1", "DoubleUpArrow":"\u21D1", "dArr":"\u21D3",
  "Downarrow":"\u21D3", "DoubleDownArrow":"\u21D3", "hArr":"\u21D4", "Leftrightarrow":"\u21D4",
  "DoubleLeftRightArrow":"\u21D4", "vArr":"\u21D5", "Updownarrow":"\u21D5", "DoubleUpDownArrow":"\u21D5",
  "lAarr":"\u21DA", "Lleftarrow":"\u21DA", "rAarr":"\u21DB", "Rrightarrow":"\u21DB",
  "comp":"\u2201", "complement":"\u2201", "nexist":"\u2204", "NotExists":"\u2204",
  "nexists":"\u2204", "empty":"\u2205", "emptyset":"\u2205", "varnothing":"\u2205",
  "prod":"\u220F", "coprod":"\u2210", "samalg":"\u2210", "sum":"\u2211",
  "Sum":"\u2211", "plusdo":"\u2214", "dotplus":"\u2214", "setmn":"\u2216",
  "ssetmn":"\u2216", "setminus":"\u2216", "setmn":"\u2216", "Backslash":"\u2216",
  "setminus":"\u2216", "Backslash":"\u2216", "ssetmn":"\u2216", "vprop":"\u221D",
  "propto":"\u221D", "Proportional":"\u221D", "varpropto":"\u221D", "ang":"\u2220",
  "angle":"\u2220", "angmsd":"\u2221", "measuredangle":"\u2221", "mid":"\u2223",
  "smid":"\u2223", "mid":"\u2223", "VerticalBar":"\u2223", "smid":"\u2223",
  "VerticalBar":"\u2223", "nmid":"\u2224", "nsmid":"\u2224", "nmid":"\u2224",
  "nsmid":"\u2224", "spar":"\u2225", "parallel":"\u2225", "DoubleVerticalBar":"\u2225",
  "shortparallel":"\u2225", "npar":"\u2226", "nspar":"\u2226", "npar":"\u2226",
  "nparallel":"\u2226", "NotDoubleVerticalBar":"\u2226", "nparallel":"\u2226", "NotDoubleVerticalBar":"\u2226",
  "nspar":"\u2226", "thksim":"\u223C", "Tilde":"\u223C", "thicksim":"\u223C",
  "bsim":"\u223D", "backsim":"\u223D", "wreath":"\u2240", "VerticalTilde":"\u2240",
  "wr":"\u2240", "nsim":"\u2241", "NotTilde":"\u2241", "nsime":"\u2244",
  "nsimeq":"\u2244", "NotTildeEqual":"\u2244", "ncong":"\u2247", "NotTildeFullEqual":"\u2247",
  "asymp":"\u2248", "thkap":"\u2248", "asymp":"\u2248", "TildeTilde":"\u2248",
  "approx":"\u2248", "TildeTilde":"\u2248", "approx":"\u2248", "thkap":"\u2248",
  "nap":"\u2249", "NotTildeTilde":"\u2249", "napprox":"\u2249", "ape":"\u224A",
  "approxeq":"\u224A", "bcong":"\u224C", "backcong":"\u224C", "bump":"\u224E",
  "HumpDownHump":"\u224E", "Bumpeq":"\u224E", "bumpe":"\u224F", "HumpEqual":"\u224F",
  "bumpeq":"\u224F", "esdot":"\u2250", "DotEqual":"\u2250", "doteq":"\u2250",
  "eDot":"\u2251", "doteqdot":"\u2251", "efDot":"\u2252", "fallingdotseq":"\u2252",
  "erDot":"\u2253", "risingdotseq":"\u2253", "colone":"\u2254", "coloneq":"\u2254",
  "Assign":"\u2254", "ecolon":"\u2255", "eqcolon":"\u2255", "ecir":"\u2256",
  "eqcirc":"\u2256", "cire":"\u2257", "circeq":"\u2257", "trie":"\u225C",
  "triangleq":"\u225C", "nequiv":"\u2262", "NotCongruent":"\u2262", "lE":"\u2266",
  "LessFullEqual":"\u2266", "leqq":"\u2266", "nlE":"\u2266\u0338", "NotGreaterFullEqual":"\u2266\u0338",
  "nleqq":"\u2266\u0338", "gE":"\u2267", "GreaterFullEqual":"\u2267", "geqq":"\u2267",
  "ngE":"\u2267\u0338", "ngeqq":"\u2267\u0338", "lnE":"\u2268", "lneqq":"\u2268",
  "lvnE":"\u2268\uFE00", "lvertneqq":"\u2268\uFE00", "gnE":"\u2269", "gneqq":"\u2269",
  "gvnE":"\u2269\uFE00", "gvertneqq":"\u2269\uFE00", "Lt":"\u226A", "NestedLessLess":"\u226A",
  "ll":"\u226A", "Gt":"\u226B", "NestedGreaterGreater":"\u226B", "gg":"\u226B",
  "twixt":"\u226C", "between":"\u226C", "nlt":"\u226E", "NotLess":"\u226E",
  "nless":"\u226E", "ngt":"\u226F", "NotGreater":"\u226F", "ngtr":"\u226F",
  "nle":"\u2270", "NotLessEqual":"\u2270", "nleq":"\u2270", "nge":"\u2271",
  "NotGreaterEqual":"\u2271", "ngeq":"\u2271", "lsim":"\u2272", "LessTilde":"\u2272",
  "lesssim":"\u2272", "gsim":"\u2273", "gtrsim":"\u2273", "GreaterTilde":"\u2273",
  "lg":"\u2276", "lessgtr":"\u2276", "LessGreater":"\u2276", "gl":"\u2277",
  "gtrless":"\u2277", "GreaterLess":"\u2277", "pr":"\u227A", "Precedes":"\u227A",
  "prec":"\u227A", "sc":"\u227B", "Succeeds":"\u227B", "succ":"\u227B",
  "cupre":"\u227C", "PrecedesSlantEqual":"\u227C", "preccurlyeq":"\u227C", "sccue":"\u227D",
  "SucceedsSlantEqual":"\u227D", "succcurlyeq":"\u227D", "prsim":"\u227E", "precsim":"\u227E",
  "PrecedesTilde":"\u227E", "scsim":"\u227F", "succsim":"\u227F", "SucceedsTilde":"\u227F",
  "npr":"\u2280", "nprec":"\u2280", "NotPrecedes":"\u2280", "nsc":"\u2281",
  "nsucc":"\u2281", "NotSucceeds":"\u2281", "nsub":"\u2284", "nsup":"\u2285",
  "nsube":"\u2288", "nsubseteq":"\u2288", "NotSubsetEqual":"\u2288", "nsupe":"\u2289",
  "nsupseteq":"\u2289", "NotSupersetEqual":"\u2289", "subne":"\u228A", "subsetneq":"\u228A",
  "vsubne":"\u228A\uFE00", "varsubsetneq":"\u228A\uFE00", "supne":"\u228B", "supsetneq":"\u228B",
  "vsupne":"\u228B\uFE00", "varsupsetneq":"\u228B\uFE00", "uplus":"\u228E", "UnionPlus":"\u228E",
  "sqsub":"\u228F", "SquareSubset":"\u228F", "sqsubset":"\u228F", "sqsup":"\u2290",
  "SquareSuperset":"\u2290", "sqsupset":"\u2290", "sqsube":"\u2291", "SquareSubsetEqual":"\u2291",
  "sqsubseteq":"\u2291", "sqsupe":"\u2292", "SquareSupersetEqual":"\u2292", "sqsupseteq":"\u2292",
  "sqcap":"\u2293", "SquareIntersection":"\u2293", "sqcup":"\u2294", "SquareUnion":"\u2294",
  "oplus":"\u2295", "CirclePlus":"\u2295", "ominus":"\u2296", "CircleMinus":"\u2296",
  "otimes":"\u2297", "CircleTimes":"\u2297", "osol":"\u2298", "odot":"\u2299",
  "CircleDot":"\u2299", "ocir":"\u229A", "circledcirc":"\u229A", "oast":"\u229B",
  "circledast":"\u229B", "odash":"\u229D", "circleddash":"\u229D", "plusb":"\u229E",
  "boxplus":"\u229E", "minusb":"\u229F", "boxminus":"\u229F", "timesb":"\u22A0",
  "boxtimes":"\u22A0", "sdotb":"\u22A1", "dotsquare":"\u22A1", "vdash":"\u22A2",
  "RightTee":"\u22A2", "dashv":"\u22A3", "LeftTee":"\u22A3", "top":"\u22A4",
  "DownTee":"\u22A4", "models":"\u22A7", "vDash":"\u22A8", "DoubleRightTee":"\u22A8",
  "Vdash":"\u22A9", "Vvdash":"\u22AA", "nvdash":"\u22AC", "nvDash":"\u22AD",
  "nVdash":"\u22AE", "nVDash":"\u22AF", "vltri":"\u22B2", "vartriangleleft":"\u22B2",
  "LeftTriangle":"\u22B2", "vrtri":"\u22B3", "vartriangleright":"\u22B3", "RightTriangle":"\u22B3",
  "ltrie":"\u22B4", "trianglelefteq":"\u22B4", "LeftTriangleEqual":"\u22B4", "rtrie":"\u22B5",
  "trianglerighteq":"\u22B5", "RightTriangleEqual":"\u22B5", "mumap":"\u22B8", "multimap":"\u22B8",
  "intcal":"\u22BA", "intercal":"\u22BA", "veebar":"\u22BB", "diam":"\u22C4",
  "diamond":"\u22C4", "Diamond":"\u22C4", "sdot":"\u22C5", "sstarf":"\u22C6",
  "Star":"\u22C6", "divonx":"\u22C7", "divideontimes":"\u22C7", "bowtie":"\u22C8",
  "ltimes":"\u22C9", "rtimes":"\u22CA", "lthree":"\u22CB", "leftthreetimes":"\u22CB",
  "rthree":"\u22CC", "rightthreetimes":"\u22CC", "bsime":"\u22CD", "backsimeq":"\u22CD",
  "cuvee":"\u22CE", "curlyvee":"\u22CE", "cuwed":"\u22CF", "curlywedge":"\u22CF",
  "Sub":"\u22D0", "Subset":"\u22D0", "Sup":"\u22D1", "Supset":"\u22D1",
  "Cap":"\u22D2", "Cup":"\u22D3", "fork":"\u22D4", "pitchfork":"\u22D4",
  "ldot":"\u22D6", "lessdot":"\u22D6", "gsdot":"\u22D7", "gtrdot":"\u22D7",
  "Ll":"\u22D8", "Gg":"\u22D9", "ggg":"\u22D9", "leg":"\u22DA",
  "LessEqualGreater":"\u22DA", "lesseqgtr":"\u22DA", "gel":"\u22DB", "gtreqless":"\u22DB",
  "GreaterEqualLess":"\u22DB", "cuepr":"\u22DE", "curlyeqprec":"\u22DE", "cuesc":"\u22DF",
  "curlyeqsucc":"\u22DF", "lnsim":"\u22E6", "gnsim":"\u22E7", "prnsim":"\u22E8",
  "precnsim":"\u22E8", "scnsim":"\u22E9", "succnsim":"\u22E9", "nltri":"\u22EA",
  "ntriangleleft":"\u22EA", "NotLeftTriangle":"\u22EA", "nrtri":"\u22EB", "ntriangleright":"\u22EB",
  "NotRightTriangle":"\u22EB", "nltrie":"\u22EC", "ntrianglelefteq":"\u22EC", "NotLeftTriangleEqual":"\u22EC",
  "nrtrie":"\u22ED", "ntrianglerighteq":"\u22ED", "NotRightTriangleEqual":"\u22ED", "vellip":"\u22EE",
  "barwed":"\u2305", "barwedge":"\u2305", "Barwed":"\u2306", "doublebarwedge":"\u2306",
  "lceil":"\u2308", "LeftCeiling":"\u2308", "rceil":"\u2309", "RightCeiling":"\u2309",
  "lfloor":"\u230A", "LeftFloor":"\u230A", "rfloor":"\u230B", "RightFloor":"\u230B",
  "drcrop":"\u230C", "dlcrop":"\u230D", "urcrop":"\u230E", "ulcrop":"\u230F",
  "telrec":"\u2315", "target":"\u2316", "ulcorn":"\u231C", "ulcorner":"\u231C",
  "urcorn":"\u231D", "urcorner":"\u231D", "dlcorn":"\u231E", "llcorner":"\u231E",
  "drcorn":"\u231F", "lrcorner":"\u231F", "frown":"\u2322", "sfrown":"\u2322",
  "frown":"\u2322", "sfrown":"\u2322", "smile":"\u2323", "ssmile":"\u2323",
  "smile":"\u2323", "ssmile":"\u2323", "blank":"\u2423", "oS":"\u24C8",
  "circledS":"\u24C8", "boxh":"\u2500", "boxv":"\u2502", "boxdr":"\u250C",
  "boxdl":"\u2510", "boxur":"\u2514", "boxul":"\u2518", "boxvr":"\u251C",
  "boxvl":"\u2524", "boxhd":"\u252C", "boxhu":"\u2534", "boxvh":"\u253C",
  "boxH":"\u2550", "boxV":"\u2551", "boxdR":"\u2552", "boxDr":"\u2553",
  "boxDR":"\u2554", "boxdL":"\u2555", "boxDl":"\u2556", "boxDL":"\u2557",
  "boxuR":"\u2558", "boxUr":"\u2559", "boxUR":"\u255A", "boxuL":"\u255B",
  "boxUl":"\u255C", "boxUL":"\u255D", "boxvR":"\u255E", "boxVr":"\u255F",
  "boxVR":"\u2560", "boxvL":"\u2561", "boxVl":"\u2562", "boxVL":"\u2563",
  "boxHd":"\u2564", "boxhD":"\u2565", "boxHD":"\u2566", "boxHu":"\u2567",
  "boxhU":"\u2568", "boxHU":"\u2569", "boxvH":"\u256A", "boxVh":"\u256B",
  "boxVH":"\u256C", "uhblk":"\u2580", "lhblk":"\u2584", "block":"\u2588",
  "blk14":"\u2591", "blk12":"\u2592", "blk34":"\u2593", "squ":"\u25A1",
  "Square":"\u25A1", "squf":"\u25AA", "blacksquare":"\u25AA", "rect":"\u25AD",
  "marker":"\u25AE", "xutri":"\u25B3", "bigtriangleup":"\u25B3", "utrif":"\u25B4",
  "blacktriangle":"\u25B4", "utri":"\u25B5", "triangle":"\u25B5", "rtrif":"\u25B8",
  "blacktriangleright":"\u25B8", "rtri":"\u25B9", "triangleright":"\u25B9", "xdtri":"\u25BD",
  "bigtriangledown":"\u25BD", "dtrif":"\u25BE", "blacktriangledown":"\u25BE", "dtri":"\u25BF",
  "triangledown":"\u25BF", "ltrif":"\u25C2", "blacktriangleleft":"\u25C2", "ltri":"\u25C3",
  "triangleleft":"\u25C3", "loz":"\u25CA", "lozenge":"\u25CA", "cir":"\u25CB",
  "xcirc":"\u25EF", "bigcirc":"\u25EF", "starf":"\u2605", "bigstar":"\u2605",
  "star":"\u2606", "phone":"\u260E", "female":"\u2640", "male":"\u2642",
  "spades":"\u2660", "spadesuit":"\u2660", "clubs":"\u2663", "clubsuit":"\u2663",
  "hearts":"\u2665", "heartsuit":"\u2665", "diams":"\u2666", "diamondsuit":"\u2666",
  "sung":"\u266A", "flat":"\u266D", "natur":"\u266E", "natural":"\u266E",
  "sharp":"\u266F", "check":"\u2713", "checkmark":"\u2713", "cross":"\u2717",
  "malt":"\u2720", "maltese":"\u2720", "sext":"\u2736", "xharr":"\u27F7",
  "longleftrightarrow":"\u27F7", "LongLeftRightArrow":"\u27F7", "xlArr":"\u27F8", "Longleftarrow":"\u27F8",
  "DoubleLongLeftArrow":"\u27F8", "xrArr":"\u27F9", "Longrightarrow":"\u27F9", "DoubleLongRightArrow":"\u27F9",
  "xhArr":"\u27FA", "Longleftrightarrow":"\u27FA", "DoubleLongLeftRightArrow":"\u27FA", "rpargt":"\u2994",
  "lpargt":"\u29A0", "lozf":"\u29EB", "blacklozenge":"\u29EB", "amalg":"\u2A3F",
  "les":"\u2A7D", "LessSlantEqual":"\u2A7D", "leqslant":"\u2A7D", "nles":"\u2A7D\u0338",
  "NotLessSlantEqual":"\u2A7D\u0338", "nleqslant":"\u2A7D\u0338", "ges":"\u2A7E", "GreaterSlantEqual":"\u2A7E",
  "geqslant":"\u2A7E", "nges":"\u2A7E\u0338", "NotGreaterSlantEqual":"\u2A7E\u0338", "ngeqslant":"\u2A7E\u0338",
  "lap":"\u2A85", "lessapprox":"\u2A85", "gap":"\u2A86", "gtrapprox":"\u2A86",
  "lne":"\u2A87", "lneq":"\u2A87", "gne":"\u2A88", "gneq":"\u2A88",
  "lnap":"\u2A89", "lnapprox":"\u2A89", "gnap":"\u2A8A", "gnapprox":"\u2A8A",
  "lEg":"\u2A8B", "lesseqqgtr":"\u2A8B", "gEl":"\u2A8C", "gtreqqless":"\u2A8C",
  "els":"\u2A95", "eqslantless":"\u2A95", "egs":"\u2A96", "eqslantgtr":"\u2A96",
  "pre":"\u2AAF", "preceq":"\u2AAF", "PrecedesEqual":"\u2AAF", "npre":"\u2AAF\u0338",
  "npreceq":"\u2AAF\u0338", "NotPrecedesEqual":"\u2AAF\u0338", "sce":"\u2AB0", "succeq":"\u2AB0",
  "SucceedsEqual":"\u2AB0", "nsce":"\u2AB0\u0338", "nsucceq":"\u2AB0\u0338", "NotSucceedsEqual":"\u2AB0\u0338",
  "prnE":"\u2AB5", "precneqq":"\u2AB5", "scnE":"\u2AB6", "succneqq":"\u2AB6",
  "prap":"\u2AB7", "precapprox":"\u2AB7", "scap":"\u2AB8", "succapprox":"\u2AB8",
  "prnap":"\u2AB9", "precnapprox":"\u2AB9", "scnap":"\u2ABA", "succnapprox":"\u2ABA",
  "subE":"\u2AC5", "subseteqq":"\u2AC5", "nsubE":"\u2AC5\u0338", "nsubseteqq":"\u2AC5\u0338",
  "supE":"\u2AC6", "supseteqq":"\u2AC6", "nsupE":"\u2AC6\u0338", "nsupseteqq":"\u2AC6\u0338",
  "subnE":"\u2ACB", "subsetneqq":"\u2ACB", "vsubnE":"\u2ACB\uFE00", "varsubsetneqq":"\u2ACB\uFE00",
  "supnE":"\u2ACC", "supsetneqq":"\u2ACC", "vsupnE":"\u2ACC\uFE00", "varsupsetneqq":"\u2ACC\uFE00",
  "b.Gamma":"\uD835\uDEAA", "b.Delta":"\uD835\uDEAA", "b.Theta":"\uD835\uDEAF", "b.Lambda":"\uD835\uDEB2",
  "b.Xi":"\uD835\uDEB5", "b.Pi":"\uD835\uDEB7", "b.Sigma":"\uD835\uDEBA", "b.Upsi":"\uD835\uDEBC",
  "b.Phi":"\uD835\uDEBD", "b.Psi":"\uD835\uDEBF", "b.Omega":"\uD835\uDEC0", "b.alpha":"\uD835\uDEC2",
  "b.beta":"\uD835\uDEC3", "b.gamma":"\uD835\uDEC4", "b.delta":"\uD835\uDEC5", "b.epsi":"\uD835\uDEC6",
  "b.zeta":"\uD835\uDEC7", "b.eta":"\uD835\uDEC8", "b.thetas":"\uD835\uDEC9", "b.iota":"\uD835\uDECA",
  "b.kappa":"\uD835\uDECB", "b.lambda":"\uD835\uDECC", "b.mu":"\uD835\uDECD", "b.nu":"\uD835\uDECE",
  "b.xi":"\uD835\uDECF", "b.pi":"\uD835\uDED1", "b.rho":"\uD835\uDED2", "b.sigmav":"\uD835\uDED3",
  "b.sigma":"\uD835\uDED4", "b.tau":"\uD835\uDED5", "b.upsi":"\uD835\uDED6", "b.phi":"\uD835\uDED7",
  "b.chi":"\uD835\uDED8", "b.psi":"\uD835\uDED9", "b.omega":"\uD835\uDEDA", "b.epsiv":"\uD835\uDEDC",
  "b.thetav":"\uD835\uDEDD", "b.kappav":"\uD835\uDEDE", "b.phiv":"\uD835\uDEDF", "b.rhov":"\uD835\uDEE0",
  "b.piv":"\uD835\uDEE1", "fflig":"\uFB00", "filig":"\uFB01", "fllig":"\uFB02",
  "ffilig":"\uFB03", "ffllig":"\uFB04", "sbsol":"\uFE68"
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.nature.com/onc/journal/v31/n6/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "J.",
						"lastName": "Jiang",
						"creatorType": "author"
					},
					{
						"firstName": "Y.",
						"lastName": "Zhang",
						"creatorType": "author"
					},
					{
						"firstName": "S.",
						"lastName": "Chuai",
						"creatorType": "author"
					},
					{
						"firstName": "Z.",
						"lastName": "Wang",
						"creatorType": "author"
					},
					{
						"firstName": "D.",
						"lastName": "Zheng",
						"creatorType": "author"
					},
					{
						"firstName": "F.",
						"lastName": "Xu",
						"creatorType": "author"
					},
					{
						"firstName": "Y.",
						"lastName": "Zhang",
						"creatorType": "author"
					},
					{
						"firstName": "C.",
						"lastName": "Li",
						"creatorType": "author"
					},
					{
						"firstName": "Y.",
						"lastName": "Liang",
						"creatorType": "author"
					},
					{
						"firstName": "Z.",
						"lastName": "Chen",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"ONC",
					"oncogenes",
					"cancer",
					"apoptosis",
					"tumor suppressor genes",
					"tumor viruses",
					"molecular oncology",
					"cell cycle",
					"growth factors",
					"growth factor receptors",
					"apoptosis",
					"growth regulatory genes"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
				"title": "Trastuzumab (herceptin) targets gastric cancer stem cells characterized by CD90 phenotype",
				"publicationTitle": "Oncogene",
				"rights": "© 2011 Nature Publishing Group",
				"volume": "31",
				"issue": "6",
				"number": "6",
				"patentNumber": "6",
				"pages": "671-682",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "2012",
				"ISSN": "0950-9232",
				"language": "en",
				"DOI": "10.1038/onc.2011.282",
				"abstractNote": "Identification and characterization of cancer stem cells (CSCs) in gastric cancer are difficult owing to the lack of specific markers and consensus methods. In this study, we show that cells with the CD90 surface marker in gastric tumors could be enriched under non-adherent, serum-free and sphere-forming conditions. These CD90+ cells possess a higher ability to initiate tumor in vivo and could re-establish the cellular hierarchy of tumors from single-cell implantation, demonstrating their self-renewal properties. Interestingly, higher proportion of CD90+ cells correlates with higher in vivo tumorigenicity of gastric primary tumor models. In addition, it was found that ERBB2 was overexpressed in about 25% of the gastric primary tumor models, which correlates with the higher level of CD90 expression in these tumors. Trastuzumab (humanized anti-ERBB2 antibody) treatment of high-tumorigenic gastric primary tumor models could reduce the CD90+ population in tumor mass and suppress tumor growth when combined with traditional chemotherapy. Moreover, tumorigenicity of tumor cells could also be suppressed when trastuzumab treatment starts at the same time as cell implantation. Therefore, we have identified a CSC population in gastric primary tumors characterized by their CD90 phenotype. The finding that trastuzumab targets the CSC population in gastric tumors suggests that ERBB2 signaling has a role in maintaining CSC populations, thus contributing to carcinogenesis and tumor invasion. In conclusion, the results from this study provide new insights into the gastric tumorigenic process and offer potential implications for the development of anticancer drugs as well as therapeutic treatment of gastric cancers.",
				"url": "http://www.nature.com/onc/journal/v31/n6/full/onc2011282a.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/emboj/journal/v31/n7/full/emboj201217a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Er-Chieh",
						"lastName": "Cho",
						"creatorType": "author"
					},
					{
						"firstName": "Shunsheng",
						"lastName": "Zheng",
						"creatorType": "author"
					},
					{
						"firstName": "Shonagh",
						"lastName": "Munro",
						"creatorType": "author"
					},
					{
						"firstName": "Geng",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Simon M.",
						"lastName": "Carr",
						"creatorType": "author"
					},
					{
						"firstName": "Jutta",
						"lastName": "Moehlenbrink",
						"creatorType": "author"
					},
					{
						"firstName": "Yi-Chien",
						"lastName": "Lu",
						"creatorType": "author"
					},
					{
						"firstName": "Lindsay",
						"lastName": "Stimson",
						"creatorType": "author"
					},
					{
						"firstName": "Omar",
						"lastName": "Khan",
						"creatorType": "author"
					},
					{
						"firstName": "Rebecca",
						"lastName": "Konietzny",
						"creatorType": "author"
					},
					{
						"firstName": "Joanna",
						"lastName": "McGouran",
						"creatorType": "author"
					},
					{
						"firstName": "Amanda S.",
						"lastName": "Coutts",
						"creatorType": "author"
					},
					{
						"firstName": "Benedikt",
						"lastName": "Kessler",
						"creatorType": "author"
					},
					{
						"firstName": "David J.",
						"lastName": "Kerr",
						"creatorType": "author"
					},
					{
						"firstName": "Nicholas B. La",
						"lastName": "Thangue",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"The EMBO Journal",
					"European Molecular Biology Organization",
					"science",
					"scientific journal",
					"biology articles",
					"cell signalling",
					"cell biology",
					"structure",
					"biological research",
					"journal of cell biology",
					"molecular and cellular biology",
					"genetics",
					"biochemistry",
					"molecular cell biology",
					"molecular biology of the cell",
					"development",
					"immunology",
					"neuroscience",
					"plant biology",
					"structural biology",
					"genomic and computational biology",
					"genome stability and dynamics",
					"chromatin and transcription",
					"RNA",
					"proteins",
					"cellular metabolism",
					"signal transduction",
					"cell cycle",
					"differentiation and death",
					"membranes and transport",
					"cell and tissue architecture",
					"microbiology and pathogens",
					"molecular biology of disease."
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/emboj/journal/v31/n7/full/emboj201217a.html",
				"title": "Arginine methylation controls growth regulation by E2F-1",
				"publicationTitle": "The EMBO Journal",
				"rights": "© 2012 Nature Publishing Group",
				"volume": "31",
				"issue": "7",
				"number": "7",
				"patentNumber": "7",
				"pages": "1785-1797",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "04/04/2012",
				"ISSN": "ERROR! NO ISSN",
				"language": "en",
				"DOI": "10.1038/emboj.2012.17",
				"abstractNote": "E2F transcription factors are implicated in diverse cellular functions. The founding member, E2F-1, is endowed with contradictory activities, being able to promote cell-cycle progression and induce apoptosis. However, the mechanisms that underlie the opposing outcomes of E2F-1 activation remain largely unknown. We show here that E2F-1 is directly methylated by PRMT5 (protein arginine methyltransferase 5), and that arginine methylation is responsible for regulating its biochemical and functional properties, which impacts on E2F-1-dependent growth control. Thus, depleting PRMT5 causes increased E2F-1 protein levels, which coincides with decreased growth rate and associated apoptosis. Arginine methylation influences E2F-1 protein stability, and the enhanced transcription of a variety of downstream target genes reflects increased E2F-1 DNA-binding activity. Importantly, E2F-1 is methylated in tumour cells, and a reduced level of methylation is evident under DNA damage conditions that allow E2F-1 stabilization and give rise to apoptosis. Significantly, in a subgroup of colorectal cancer, high levels of PRMT5 frequently coincide with low levels of E2F-1 and reflect a poor clinical outcome. Our results establish that arginine methylation regulates the biological activity of E2F-1 activity, and raise the possibility that arginine methylation contributes to tumourigenesis by influencing the E2F pathway.",
				"url": "http://www.nature.com/emboj/journal/v31/n7/full/emboj201217a.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/onc/topten/index.html",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nature/journal/v481/n7381/full/nature10669.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "S.",
						"lastName": "Vegetti",
						"creatorType": "author"
					},
					{
						"firstName": "D. J.",
						"lastName": "Lagattuta",
						"creatorType": "author"
					},
					{
						"firstName": "J. P.",
						"lastName": "McKean",
						"creatorType": "author"
					},
					{
						"firstName": "M. W.",
						"lastName": "Auger",
						"creatorType": "author"
					},
					{
						"firstName": "C. D.",
						"lastName": "Fassnacht",
						"creatorType": "author"
					},
					{
						"firstName": "L. V. E.",
						"lastName": "Koopmans",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Astronomy",
					"Astrophysics"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/nature/journal/v481/n7381/full/nature10669.html",
				"title": "Gravitational detection of a low-mass dark satellite galaxy at cosmological distance",
				"publicationTitle": "Nature",
				"rights": "© 2012 Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
				"volume": "481",
				"pages": "341-343",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "19 January 2012",
				"ISSN": "0028-0836",
				"language": "en",
				"issue": "7381",
				"DOI": "10.1038/nature10669",
				"abstractNote": "The mass function of dwarf satellite galaxies that are observed around Local Group galaxies differs substantially from simulations based on cold dark matter: the simulations predict many more dwarf galaxies than are seen. The Local Group, however, may be anomalous in this regard. A massive dark satellite in an early-type lens galaxy at a redshift of 0.222 was recently found using a method based on gravitational lensing, suggesting that the mass fraction contained in substructure could be higher than is predicted from simulations. The lack of very low-mass detections, however, prohibited any constraint on their mass function. Here we report the presence of a (1.9 ± 0.1) × 108nature10669-m1jpg19K2716 dark satellite galaxy in the Einstein ring system JVAS B1938+666 (ref. 11) at a redshift of 0.881, where nature10669-m2jpg20K2716 denotes the solar mass. This satellite galaxy has a mass similar to that of the Sagittarius galaxy, which is a satellite of the Milky Way. We determine the logarithmic slope of the mass function for substructure beyond the local Universe to be nature10669-m3jpg21K4620, with an average mass fraction of nature10669-m4jpg21K4820 per cent, by combining data on both of these recently discovered galaxies. Our results are consistent with the predictions from cold dark matter simulations at the 95 per cent confidence level, and therefore agree with the view that galaxies formed hierarchically in a Universe composed of cold dark matter.",
				"url": "http://www.nature.com/nature/journal/v481/n7381/full/nature10669.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nature/journal/v481/n7381/full/481237a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [],
				"notes": [],
				"tags": [
					"Policy",
					"Politics",
					"History"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/nature/journal/v481/n7381/full/481237a.html",
				"title": "Antarctic Treaty is cold comfort",
				"publicationTitle": "Nature",
				"rights": "© 2012 Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
				"volume": "481",
				"pages": "237-237",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "19 January 2012",
				"ISSN": "0028-0836",
				"language": "en",
				"issue": "7381",
				"DOI": "10.1038/481237a",
				"abstractNote": "Researchers need to cement the bond between science and the South Pole if the region is to remain one of peace and collaboration.",
				"url": "http://www.nature.com/nature/journal/v481/n7381/full/481237a.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nature/journal/v481/n7381/full/nature10728.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Peter J.",
						"lastName": "Watson",
						"creatorType": "author"
					},
					{
						"firstName": "Louise",
						"lastName": "Fairall",
						"creatorType": "author"
					},
					{
						"firstName": "Guilherme M.",
						"lastName": "Santos",
						"creatorType": "author"
					},
					{
						"firstName": "John W. R.",
						"lastName": "Schwabe",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Structural biology",
					"Biochemistry"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/nature/journal/v481/n7381/full/nature10728.html",
				"title": "Structure of HDAC3 bound to co-repressor and inositol tetraphosphate",
				"publicationTitle": "Nature",
				"rights": "© 2011 Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
				"volume": "481",
				"pages": "335-340",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "19 January 2012",
				"ISSN": "0028-0836",
				"language": "en",
				"issue": "7381",
				"DOI": "10.1038/nature10728",
				"url": "http://www.nature.com/nature/journal/v481/n7381/full/nature10728.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com",
				"abstractNote": "Histone deacetylase enzymes (HDACs) are emerging cancer drug targets. They regulate gene expression by removing acetyl groups from lysine residues in histone tails, resulting in chromatin condensation. The enzymatic activity of most class I HDACs requires recruitment into multi-subunit co-repressor complexes, which are in turn recruited to chromatin by repressive transcription factors. Here we report the structure of a complex between an HDAC and a co-repressor, namely, human HDAC3 with the deacetylase activation domain (DAD) from the human SMRT co-repressor (also known as NCOR2). The structure reveals two remarkable features. First, the SMRT-DAD undergoes a large structural rearrangement on forming the complex. Second, there is an essential inositol tetraphosphate molecule—d-myo-inositol-(1,4,5,6)-tetrakisphosphate (Ins(1,4,5,6)P4)—acting as an ‘intermolecular glue’ between the two proteins. Assembly of the complex is clearly dependent on the Ins(1,4,5,6)P4, which may act as a regulator—potentially explaining why inositol phosphates and their kinases have been found to act as transcriptional regulators. This mechanism for the activation of HDAC3 appears to be conserved in class I HDACs from yeast to humans, and opens the way to novel therapeutic opportunities."
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/ng/journal/v38/n11/full/ng1901.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Jason S.",
						"lastName": "Carroll",
						"creatorType": "author"
					},
					{
						"firstName": "Clifford A.",
						"lastName": "Meyer",
						"creatorType": "author"
					},
					{
						"firstName": "Jun",
						"lastName": "Song",
						"creatorType": "author"
					},
					{
						"firstName": "Wei",
						"lastName": "Li",
						"creatorType": "author"
					},
					{
						"firstName": "Timothy R.",
						"lastName": "Geistlinger",
						"creatorType": "author"
					},
					{
						"firstName": "Jérôme",
						"lastName": "Eeckhoute",
						"creatorType": "author"
					},
					{
						"firstName": "Alexander S.",
						"lastName": "Brodsky",
						"creatorType": "author"
					},
					{
						"firstName": "Erika Krasnickas",
						"lastName": "Keeton",
						"creatorType": "author"
					},
					{
						"firstName": "Kirsten C.",
						"lastName": "Fertuck",
						"creatorType": "author"
					},
					{
						"firstName": "Giles F.",
						"lastName": "Hall",
						"creatorType": "author"
					},
					{
						"firstName": "Qianben",
						"lastName": "Wang",
						"creatorType": "author"
					},
					{
						"firstName": "Stefan",
						"lastName": "Bekiranov",
						"creatorType": "author"
					},
					{
						"firstName": "Victor",
						"lastName": "Sementchenko",
						"creatorType": "author"
					},
					{
						"firstName": "Edward A.",
						"lastName": "Fox",
						"creatorType": "author"
					},
					{
						"firstName": "Pamela A.",
						"lastName": "Silver",
						"creatorType": "author"
					},
					{
						"firstName": "Thomas R.",
						"lastName": "Gingeras",
						"creatorType": "author"
					},
					{
						"firstName": "X. Shirley",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Myles",
						"lastName": "Brown",
						"creatorType": "author"
					}
				],
				"notes": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/ng/journal/v38/n11/full/ng1901.html",
				"title": "Genome-wide analysis of estrogen receptor binding sites",
				"publicationTitle": "Nature Genetics",
				"rights": "© 2006 Nature Publishing Group",
				"volume": "38",
				"issue": "11",
				"number": "11",
				"patentNumber": "11",
				"pages": "1289-1297",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "11/01/2006",
				"ISSN": "ERROR! NO ISSN",
				"language": "en",
				"DOI": "10.1038/ng1901",
				"url": "http://www.nature.com/ng/journal/v38/n11/full/ng1901.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nature/journal/v462/n7269/full/nature08497.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Melissa J.",
						"lastName": "Fullwood",
						"creatorType": "author"
					},
					{
						"firstName": "Mei Hui",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "You Fu",
						"lastName": "Pan",
						"creatorType": "author"
					},
					{
						"firstName": "Jun",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Han",
						"lastName": "Xu",
						"creatorType": "author"
					},
					{
						"firstName": "Yusoff Bin",
						"lastName": "Mohamed",
						"creatorType": "author"
					},
					{
						"firstName": "Yuriy L.",
						"lastName": "Orlov",
						"creatorType": "author"
					},
					{
						"firstName": "Stoyan",
						"lastName": "Velkov",
						"creatorType": "author"
					},
					{
						"firstName": "Andrea",
						"lastName": "Ho",
						"creatorType": "author"
					},
					{
						"firstName": "Poh Huay",
						"lastName": "Mei",
						"creatorType": "author"
					},
					{
						"firstName": "Elaine G. Y.",
						"lastName": "Chew",
						"creatorType": "author"
					},
					{
						"firstName": "Phillips Yao Hui",
						"lastName": "Huang",
						"creatorType": "author"
					},
					{
						"firstName": "Willem-Jan",
						"lastName": "Welboren",
						"creatorType": "author"
					},
					{
						"firstName": "Yuyuan",
						"lastName": "Han",
						"creatorType": "author"
					},
					{
						"firstName": "Hong Sain",
						"lastName": "Ooi",
						"creatorType": "author"
					},
					{
						"firstName": "Pramila N.",
						"lastName": "Ariyaratne",
						"creatorType": "author"
					},
					{
						"firstName": "Vinsensius B.",
						"lastName": "Vega",
						"creatorType": "author"
					},
					{
						"firstName": "Yanquan",
						"lastName": "Luo",
						"creatorType": "author"
					},
					{
						"firstName": "Peck Yean",
						"lastName": "Tan",
						"creatorType": "author"
					},
					{
						"firstName": "Pei Ye",
						"lastName": "Choy",
						"creatorType": "author"
					},
					{
						"firstName": "K. D. Senali Abayratna",
						"lastName": "Wansa",
						"creatorType": "author"
					},
					{
						"firstName": "Bing",
						"lastName": "Zhao",
						"creatorType": "author"
					},
					{
						"firstName": "Kar Sian",
						"lastName": "Lim",
						"creatorType": "author"
					},
					{
						"firstName": "Shi Chi",
						"lastName": "Leow",
						"creatorType": "author"
					},
					{
						"firstName": "Jit Sin",
						"lastName": "Yow",
						"creatorType": "author"
					},
					{
						"firstName": "Roy",
						"lastName": "Joseph",
						"creatorType": "author"
					},
					{
						"firstName": "Haixia",
						"lastName": "Li",
						"creatorType": "author"
					},
					{
						"firstName": "Kartiki V.",
						"lastName": "Desai",
						"creatorType": "author"
					},
					{
						"firstName": "Jane S.",
						"lastName": "Thomsen",
						"creatorType": "author"
					},
					{
						"firstName": "Yew Kok",
						"lastName": "Lee",
						"creatorType": "author"
					},
					{
						"firstName": "R. Krishna Murthy",
						"lastName": "Karuturi",
						"creatorType": "author"
					},
					{
						"firstName": "Thoreau",
						"lastName": "Herve",
						"creatorType": "author"
					},
					{
						"firstName": "Guillaume",
						"lastName": "Bourque",
						"creatorType": "author"
					},
					{
						"firstName": "Hendrik G.",
						"lastName": "Stunnenberg",
						"creatorType": "author"
					},
					{
						"firstName": "Xiaoan",
						"lastName": "Ruan",
						"creatorType": "author"
					},
					{
						"firstName": "Valere",
						"lastName": "Cacheux-Rataboul",
						"creatorType": "author"
					},
					{
						"firstName": "Wing-Kin",
						"lastName": "Sung",
						"creatorType": "author"
					},
					{
						"firstName": "Edison T.",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Chia-Lin",
						"lastName": "Wei",
						"creatorType": "author"
					},
					{
						"firstName": "Edwin",
						"lastName": "Cheung",
						"creatorType": "author"
					},
					{
						"firstName": "Yijun",
						"lastName": "Ruan",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Nature",
					"science",
					"science news",
					"biology",
					"physics",
					"genetics",
					"astronomy",
					"astrophysics",
					"quantum physics",
					"evolution",
					"evolutionary biology",
					"geophysics",
					"climate change",
					"earth science",
					"materials science",
					"interdisciplinary science",
					"science policy",
					"medicine",
					"systems biology",
					"genomics",
					"transcriptomics",
					"palaeobiology",
					"ecology",
					"molecular biology",
					"cancer",
					"immunology",
					"pharmacology",
					"development",
					"developmental biology",
					"structural biology",
					"biochemistry",
					"bioinformatics",
					"computational biology",
					"nanotechnology",
					"proteomics",
					"metabolomics",
					"biotechnology",
					"drug discovery",
					"environmental science",
					"life",
					"marine biology",
					"medical research",
					"neuroscience",
					"neurobiology",
					"functional genomics",
					"molecular interactions",
					"RNA",
					"DNA",
					"cell cycle",
					"signal transduction",
					"cell signalling"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"itemID": "http://www.nature.com/nature/journal/v462/n7269/full/nature08497.html",
				"title": "An oestrogen-receptor-α-bound human chromatin interactome",
				"publicationTitle": "Nature",
				"rights": "© 2009 Nature Publishing Group",
				"volume": "462",
				"issue": "7269",
				"number": "7269",
				"patentNumber": "7269",
				"pages": "58-64",
				"publisher": "Nature Publishing Group",
				"institution": "Nature Publishing Group",
				"company": "Nature Publishing Group",
				"label": "Nature Publishing Group",
				"distributor": "Nature Publishing Group",
				"date": "2009-11-05",
				"ISSN": "0028-0836",
				"language": "en",
				"DOI": "10.1038/nature08497",
				"abstractNote": "Genomes are organized into high-level three-dimensional structures, and DNA elements separated by long genomic distances can in principle interact functionally. Many transcription factors bind to regulatory DNA elements distant from gene promoters. Although distal binding sites have been shown to regulate transcription by long-range chromatin interactions at a few loci, chromatin interactions and their impact on transcription regulation have not been investigated in a genome-wide manner. Here we describe the development of a new strategy, chromatin interaction analysis by paired-end tag sequencing (ChIA-PET) for the de novo detection of global chromatin interactions, with which we have comprehensively mapped the chromatin interaction network bound by oestrogen receptor α (ER-α) in the human genome. We found that most high-confidence remote ER-α-binding sites are anchored at gene promoters through long-range chromatin interactions, suggesting that ER-α functions by extensive chromatin looping to bring genes together for coordinated transcriptional regulation. We propose that chromatin interactions constitute a primary mechanism for regulating transcription in mammalian genomes.",
				"url": "http://www.nature.com/nature/journal/v462/n7269/full/nature08497.html",
				"accessDate": "CURRENT_TIMESTAMP",
				"libraryCatalog": "www.nature.com"
			}
		]
	}
]
/** END TEST CASES **/
