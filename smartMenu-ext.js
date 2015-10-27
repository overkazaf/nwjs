/**
 *
 * @authors John Nong (overkazaf@gmail.com)
 * @qq      289202839
 * @date    2015-04-17 11:52:45
 *          第一波重构开始, 废弃了iframe的实现, 采用一个容器进行dom的操作, 关联的东西太多, 未优化资源加载及dom操作
 *          
 * @update  2015-07-13 11:29:40
 *          1.增加了新部件
 *          2.增加了部件分类
 *          3.增强了ftlTransformer的容错能力
 *          4.增强了布局高度的配置和计算
 *          
 * @update  2015-08-14 09:36:10
 *          1.不同部件分类下的渲染策略区分
 *
 * @update  2015-09-01 22:18:50
 *          1.增加部件钩子,让列表页部件自动绑定站点和栏目
 *          
 * @update  2015-09-06 11:00:50
 *          1.增加内容页的模板部件
 *
 * @update  2015-10-08 08:35:50
 *          1.增加内容页的模板部件
 * 
 * @version 1.2
 */

//smartMenu-ext.js
//		Define some utils to combine with smartMenu plugin,
//		This part will implement some operation logic for operable elements to make changes 

/**
 *	dictCache will act like an ATM, which you put a card in and take cash out
 * 	dictCache = {
 * 		type0 : data0,
 * 		type1 : data1,
 * 		......
 * 	};
 */

var
	multiSiteIds = {},
	multiSiteColumns = {},
	ftlCache = {}, // 数据缓存，用于生成FreeMarker标签时取值
	ftlDict = {
		'getSite': 'site',
		'getSiteColumn': 'siteColumn'
	},
	ftlTypes = [ // 按优先级排序的ftl类型
		'asidenav', // 侧边导航
		'navbox', // 竖向导航
		'img-scroll-h', // 水平滚动图片
		'attrlist', // 附件列表
		'article', // 正文（带标题）
		'article-title', // 正文标题
		'article-author', // 正文作者
		'article-share', // 正文分享
		'article-date', // 文章发布时间
		'article-contents', // 文章内容
		'scroll-h', // 水平滚动
		'scroll-v', // 垂直滚动
		'location', // 当前位置
		'digest', // 摘要
		'bot_ppt', // 底部带缩略图的幻灯
		'slidetop', // 幻灯(上下滑动)
		'slidenormal', // 带文字标题幻灯
		'easyslides', // 简易幻灯
		'img-list', // 图片列表
		'img-news', // 图文信息（普通）
		'img-news-h', // 图文信息（水平）
		'img-news-v', // 图文信息（垂直）
		'panel-pic-v', // 图片+信息列表，单栏目双图片，多行
		'panel-pic', // 图片+信息列表，单栏目，单行
		'panel-type0',
		'panel-type1',
		'panel-type2',
		'panel-type3',
		'panel-type4',
		'panel-type5',
		'panel-type6',
		'panel-type7',
		'panel-type8',
		'panel-type9',
		'panel-typea',
		'panel-typeb',
		'panel-typec',
		'panel-typed',
		'panel-typee',
		'panel-typef',
		'panel-unsorted',
		'cont-tpl',
		'cont-tpl1',
		'cont-tpl2',
		'cont-tpl3',
		'nav-auto' // 自动生成的导航栏， 目前可选几个样式
	],
	// 定义不同类型的部件数组，以区分其渲染策略
	homeWidgetTypes = [], // 这个类型的部件，站点简称和栏目简称需要手动配置
	listWidgetTypes = [], // 这个类型的部件，站点简称和栏目简称是自动获取的
	topicWidgetTypes = [], // 这个类型的部件，站点简称和栏目简称是自动获取的
	contentWidgetType = [], // 这个类型的部件，站点简称和栏目简称是自动获取的
	ftlHandler = {
		/**
		 * [writeFtlCache 为ftl别名映射写缓存]
		 * @param  {[String]} type  [缓存类型]
		 * @param  {[Object Array]} data  [缓存数据]
		 * @param  {[Boolean]} force [是否强行写]
		 * @return {[void]}       [description]
		 */
		writeFtlCache: function(type, data, force) {
			if (!type) {
				ftlCache[type] = {};
				//throw new Error('This ftlCache type is not specified!');
			}

			if (force) {
				// 强行写
				ftlCache[type] = data;
			} else {
				if (!ftlCache[type]) {
					ftlCache[type] = data;
				}
			}
		},
		/**
		 * [judgeFtlType 判断类型是否需要存入ftlCache中]
		 * @param  {[type]} type [description]
		 * @return {[type]}      [String]
		 */
		judgeFtlType: function(type) {
			if (type in ftlDict) {
				return ftlDict[type];
			}
			return undefined;
		},
		fetchType: function(dom) {
			var fetched;
			$.each(ftlTypes, function(i, className) {
				if (dom.hasClass(className)) {
					fetched = className;
				}
			});
			return fetched;
		},
		/**
		 * [getFtlType 获取一个ftl缓存的所有数据]
		 * @param  {[type]} type [description]
		 * @return {[type]}      [description]
		 */
		getFtlType: function(type) {
			return ftlCache[type];
		},
		/**
		 * [fetchKey 通过给定的k-v对，获取指定的key对应value值]
		 * @param  {[String]} type      [ftl缓存类型]
		 * @param  {[String]} key       [缓存键]
		 * @param  {[String]} val       [缓存值]
		 * @param  {[String]} targetKey [目标键]
		 * @return {[String]}           [目标值]
		 */
		fetchKey: function(type, key, val, targetKey) {
			var cache = ftlCache[type];
			if (cache && cache.length) {
				for (var i = 0, elem; elem = cache[i++];) {
					if (key in elem) {
						if (elem[key] === val) {
							return elem[targetKey];
						}
					}
				}
			}
			return undefined;
		}
	},
	Utils = {
		/**
		 * [HTMLUnescape html code stripping]
		 * @param {[String]} str [stripped string]
		 */
		HTMLUnescape: function(str) {
			return String(str)
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>');
		},

		/**
		 * [rgb2hex Change color format from rbg to hex]
		 * @param  {[type]} rgb [description]
		 * @return {[type]}     [description]
		 */
		rgb2hex: function(rgb) {
			rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

			function hex(x) {
				return ("0" + parseInt(x).toString(16)).slice(-2);
			}
			return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
		},

		/**
		 * [parseKV2Json description]
		 * @param  {[type]} str [A ';' and '=' separated string that need to be parsed ]
		 * @return {[type]}     [An json object that formats well in key-value form]
		 */
		parseKV2Json: function(str) {
			var obj = {};
			if (str && str.indexOf(';') >= 0) {
				var array = str.split(';'),
					i,
					len = array.length;

				for (i = 0; i < len; i++) {
					if (array[i].indexOf('=') >= 0) {
						var p = array[i].split('=');
						if (p.length == 2) {
							// Valid format
							obj[p[0]] = p[1];
						} else {
							continue;
						}
					}
				}
			}
			return obj;
		},
		/**
		 * [targetCurrentElement 用于定位位于单个容器内多个子部件的索引]
		 * @param  {[Event]} ev    [事件对象]
		 * @param  {[$element array]} lists [子部件列表]
		 * @return {[number]}       [命中的对象索引]
		 */
		targetCurrentElement: function(ev, lists) {
			var targetIndex = 0;
			$.each(lists, function(index, cont) {
				var list = $(this);
				var listRect = {
					left: list.offset().left,
					right: list.offset().left + list.width(),
					top: list.offset().top,
					bottom: list.offset().top + list.height()
				};

				if (ev.pageX >= listRect.left && ev.pageX <= listRect.right) {
					if (ev.pageY >= listRect.top && ev.pageY <= listRect.bottom) {
						lists.eq(index).addClass('widgetHighLight');
						targetIndex = index;
					}
				}
			});
			return targetIndex;
		}
	},
	widgetDict = {
		/**
		 * [widgetDict 部件字典，主要用于提示信息展示]
		 * @type {Object}
		 */
		'text': '文字',
		'vote': '投票',
		'link-panel': '快速通道',
		'flash': 'FLASH',
		'powerpoint': '幻灯片',
		'upload': '图片上传',
		'navbar': '站点栏目',
		'panel': '新闻面板',
		'panel-list': '内容选项卡',
		'panel-list-item': '选项卡标签',
		'footer': '站点底部',
		'imgchunk': '专题图片',
		'img-list': '图片列表',
		'navbar-list': '导航栏',
		'text,href': '文字链接',
		'chunk': '块',
		'news-group': '列表组',
		'img-news': '图文信息（普通）',
		'img-news-h': '图文信息（水平）',
		'img-news-v': '图文信息（垂直）',
		'site-list': '栏目列表',
		'site-list-item': '栏目列表项',
		'dropdown': '下拉菜单',
		'visitors': '访问量',
		'querybar': '搜索框',
		'login': '登陆框',
		'tab': '选项卡',
		'tab-menu': '选项卡菜单',
		'tab-panel': '选项卡面板',
		'float': '悬浮部件',
		'date': '时间插件',
		'weather': '天气预报',
		'countdown': '倒计时',
		'bot_ppt': '幻灯片（底部缩略图）',
		'easyslides': '简易幻灯片',
		'slidetop': '幻灯片（上下滑动）',
		'slidenormal': '幻灯片（带文字说明）',
		'digest': '正文摘要',
		'location': '当前位置',
		'scroll-h': '水平滚动',
		'scroll-v': '垂直滚动',
		'article': '正文（标题）',
		'attrlist': '附件列表',
		'img-scroll-h': '水平滚动图片',
		'asidenav': '侧边导航',
		'navbox': '竖向导航',
		'article-title': '正文标题',
		'article-author': '正文作者',
		'article-share': '正文分享',
		'article-date': '发布时间',
		'article-visitors': '正文访问量',
		'article-contents': '正文内容',
		'cont-tpl': '内容页模板',
		'cont-tpl1': '内容页模板一',
		'cont-tpl2': '内容页模板二',
		'cont-tpl3': '内容页模板三',
		'nav-auto': '静态导航一',
		'undefined': '未知'
	},
	appendableWidgetDict = {
		/**
		 * [appendableWidgetDict 允许进行添加操作的部件字典]
		 * @type {Object}
		 */
		'site-list': '栏目列表',
		'navbar-list': '导航栏',
		'panel-list': '内容选项卡',
		'imgchunk': '专题块',
		'link-panel': '快速通道',
		'tab-menu': '选项卡菜单',
		'tab-panel': '选项卡面板',
		'asidenav': '侧边导航'
	};


// 站点
// ftlCache['sites'] = {};
// 栏目
// ftlCache['siteColumns'] = {};

// 全局监听ajax，为ftl字典加入数据
$(document).ajaxComplete(function(event, jqXHR, options) {
	var url = options.url;
	// fix no json bugs
	if (url.indexOf('getHtml.do') >= 0) return;
	if (url.indexOf('?') >= 0) {
		url = url.substring(0, url.indexOf('?'));
	}
	var type = url && url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.'));
	var targetType = ftlHandler.judgeFtlType(type);
	ftlHandler.writeFtlCache(targetType, $.parseJSON(jqXHR.responseText), true);
});


/**
 * [changeSite description]
 * @return {[type]}     [While the top dropdown has been changed, change the mapping dropdown below]
 */
function changeSite() {
	$.ajax({
		url: ctxUrl + '/siteColumnController/getSiteColumn.do',
		cache: false,
		async: true,
		type: 'POST',
		data: {
			'siteId': $.trim($("#site").val())
		},
		success: function(d) {
			var data = $.parseJSON(d);
			var selectColumn = document.getElementById("siteColumn");
			selectColumn.options.length = 0;
			selectColumn.add(new Option('', ''));
			for (var i = 0, len = data.length; i < len; i++) {
				var di = data[i];
				selectColumn.add(new Option(di.columnName, di.columnId));
			}
		}
	});
};



// must require widgetComposer.js module to achieve a smooth improvement


/* 
 * Smart Menu configurations
 * This is a global var in this js file
 *
 */
var menuData = [
	[{
		text: '编辑',
		func: function() {
			//removeHighlightListener();
			
			var type = $(this).attr('operable'); // type
			var elemId = $(this).attr('data-widget-id') || $(this).attr('id'); // element id
			var _self = $(this); // 当前命中的对象
			if (dev) {
				var json = {
					type : 'column',
					id : elemId,
					currentTarget : _self
				};
				initWidgetSetting(json);
				return;
			}

			//过滤未支持的容器类
			if (type) {
				if (type != 'undefined' && type != 'layout' && (type in widgetDict)) {
					$('.widgetHighLight').removeClass('widgetHighLight');
					$(this).addClass('widgetHighLight');

					//由于部件参数的生成需要ajax请求后台数据，因此这里用异步回调构建配置面板
					//也可换成发布者/订阅者模式进行事件的订阅，此时调用关系会更加清晰　
					constructConfigPanelTemplate(type, elemId, _self, null, null, function(html) {
						renderConfigPanel(html);
					});

				} else {
					if ($(this).attr('data-type') === 'drag-layout') {
						//动态布局类, 允许其进行编辑操作
						
						var id = $(this).attr('data-layout-id');
						$('.layout-cell').removeClass('highlight');
						$(this).children('.layout-row').children('.layout-cell').addClass('highlight');


						//提取布局参数信息
						var params = $(this).attr('data-history-config');
						var html = constructLayoutConfigPanelTemplate(id, params);
						renderLayoutConfigPanel(html);
					}
				}
			} else {
				alert('不存在布局或部件');
			}
		}
	}],
	[{
		text: '添加',
		func: function(ev) {
			//removeHighlightListener();

			ev = ev || window.event;
			var type = $(this).attr('operable');
			var elemId = $(this).data('widget-id');
			var _self = $(this); // 当前焦点对象，主要用于修正无id的杂碎部件

			if (type) {
				$('.widgetHighLight').removeClass('widgetHighLight');
				$(this).addClass('widgetHighLight');

				//目前只支持以下几种部件的添加功能，对于一些多列表的部件，需要先定位其相对索引再进行添加操作
				// if(type in appendableWidgetDict)

				if (type in appendableWidgetDict) {
					if (type === 'link-panel') {
						var targetIndex = Utils.targetCurrentElement(ev, $(this).find('ul.link-list'));
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});

					} else if (type === 'imgchunk') {
						var targetIndex = Utils.targetCurrentElement(ev, $(this).find('ul'));
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					} else if (type === 'navbar-list') {
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					} else if (type === 'panel-list') {
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					} else if (type === 'tab-menu') {
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					} else if (type === 'tab-panel') {
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					} else if (type === 'asidenav') {
						constructConfigPanelTemplate(type, elemId, _self, 'append', targetIndex, function(html) {
							renderConfigPanel(html);
						});
					}
				} else {
					// corner case
					if (_self.closest('.widget-chunk').length) {
						var fixTarget = _self.closest('.widget-chunk');
						var linkPanel = fixTarget.find('.link-panel');
						if (linkPanel.length) {
							constructConfigPanelTemplate('link-panel', null, linkPanel, 'append', -1, function(html) {
								renderConfigPanel(html);
							});
						} else {
							alert('该部件暂时不支持添加功能');
						}
					} else {
						alert('该部件暂时不支持添加功能');
					}
				}
			}
		}
	}],
	[{
		text: '删除',
		func: function() {
			//removeHighlightListener();

			var type = $(this).attr('operable');
			if (type) {
				if (type === 'layout') {
					//alert('此元素不支持删除操作');
					$('.layout-cell').removeClass('highlight');
					$(this).children('.layout-row').children('.layout-cell').addClass('highlight');
					if (confirm("确认要删除这个布局?")) {
						if ($(this).find('[class*=widget]').length) {
							if (!confirm('确认移除该布局上的所有部件？')) {
								return;
							}
						}
						if ($(this).closest('.layout-container').length) {
							var container = $(this).closest('.layout-container');
							// check if it is the last layout element
							var oTop = container.closest('[data-layer=0]');
							if (container.attr('data-layer') == 1) {
								oTop.css({
									'height': 120
								}); // fix the topper level
							}
							container.remove();
						}

					}
				} else {
					$('.widgetHighLight').removeClass('widgetHighLight');
					$(this).addClass('widgetHighLight');

					//删除操作较为繁琐，需对只剩下一个子部件的情况作销毁整个部件的处理
					//We will come back soon
					var operArray = type.split(',');
					if (operArray.length == 1 && operArray[0] == 'link-item') {
						if (confirm('确认要删除这个快速通道子链接部件?')) {
							if ($(this).closest('li[operable=chunk]').length) {
								$(this).closest('li[operable=chunk]').remove();
							} else {
								$(this).remove();
							}
						}
					} else if (operArray.length == 2 && operArray[0] == 'text' && operArray[1] == 'href') {
						if (confirm("确认要删除这个" + widgetDict[type] + "部件?")) {
								if (this.parentNode && this.parentNode.tagName.toLowerCase() == 'li') {
									$(this.parentNode).remove();
								} else {
									$(this).remove();
								}
							/*
							if ($(this).closest('.link-list-item').length) {
								$(this).closest('.link-list-item').remove();
							} else if ($(this).closest('.navlist-item').length) {
								$(this).closest('.navlist-item').remove();
							} else if ($(this).closest('.friend-link-item').length){
								$(this).closest('.friend-link-item').remove();
							} else {}
							*/
						}
					} else {
						// alert('此元素不支持删除操作');
						// Ca, no time to refactor, holy crap
						if (type == "upload") {
							if ($(this).closest('.topic-slider').length) {
								if (confirm("确认要删除这个专题栏部件?")) {
									$(this).closest('.topic-slider').remove();
								}
							} else if ($(this).closest('.widget-chunk').length) {
								if (confirm("确认要删除这个块部件?")) {
									$(this).closest('.widget-chunk').remove();
								}
							} else if ($(this).closest('.widget-upload').length) {
								if (confirm("确认要删除这个图片部件?")) {
									$(this).closest('.widget-upload').remove();
								}
							} else if ($(this).closest('.widget-imgchunk').length) {
								if (confirm("确认要删除这个专题图片部件?")) {
									$(this).remove();
								}
							}
							return;
						}

						if (type == "link-panel" || type == "panel" || type == 'site-list' || type == 'panel-list-item') {
							if ($(this).closest('.widget-chunk').length && !$(this).closest('.multi-panel').length) {
								if (confirm("确认要删除这个" + widgetDict[type] + "部件?")) {
									$(this).closest('.widget-chunk').remove();
								}
							} else if ($(this).closest('.multi-panel').length) {
								if (confirm("确认要删除这个" + widgetDict[type] + "部件?")) {
									var index = $(this).index();
									var ctx = $(this).closest('.multi-panel');
									var tabContents = ctx.find('.tab-contents').children('.contents');
									tabContents.length && tabContents.eq(index).remove();
									$(this).remove();
								}
							} else {
								if (confirm("确认要删除这个" + widgetDict[type] + "部件?")) {
									if ($(this).closest('.widget-upload').length) {
										$(this).closest('.widget-upload').remove();
									} else {
										$(this).remove();
									}
								}
							}
							return;
						}

						if (confirm("确认要删除这个" + widgetDict[type] + "部件?")) {
							if (type === 'upload') {
								$(this).closest('.widget-upload').remove();
							} else if (type === 'navbar') {
								if ($(this).closest('dd').length) {
									$(this).closest('dd').remove();
								} else {
									$(this).remove();
								}
							} else if ((type == 'text' && $(this).hasClass('tab-item')) || type === 'tab-panel') {
								var $oP = $(this).closest('.widget-tab');
								var index = $(this).index();
								var $contents = $oP.find('.tab-content');
								var $menu = $oP.find('.tab-item');

								if (type === 'tab-panel') {
									$menu.eq(index).remove();
									$(this).remove();
								} else {
									$contents.eq(index).remove();
									$(this).remove();
								}
								$oP.find('.tab-item').first().trigger('mouseover');
							} else {
								$(this).remove();
							}
							return;
						}
					}
				}
			} else {
				alert('不存在布局或部件,请先添加');
			}
		}
	}],
	[{
		text: '编辑源代码',
		func: function() {
			//removeHighlightListener();

			var source = $(this).attr('data-source-code');
			if (source == 'widget' || source == 'layout') {
				// alert($(this).html());
				//mask();
			} else {
				//mask();
				var self = $(this);
				initSourceCodePanel($(this).prop('outerHTML'), function(html) {
					var $dom = $(Utils.HTMLUnescape(html));
					$(self).replaceWith($dom);
					$dom.smartMenu(menuData);
					$dom.find('*[operable]').smartMenu(menuData);
					
					if ($dom.get(0).className && $dom.get(0).className.indexOf('widget') >= 0) {
						$dom.johnDraggable();
					}
				});
			}
		}
	}],
];

/*
 *	This function is used to generate a layout configurable template
 */

function constructLayoutConfigPanelTemplate(layoutid, params) {
	var html = '',
		footer = '',
		setupUpload = null,
		fnOK = null,
		fnCancel = null;

	if (params) {
		params = params.split('$');
		var oTemplate = $('#' + layoutid);
		var aLayout = oTemplate.children('.layout-row').children(".layout-cell");
		var scaleParam = params[0].split(",");
		var marginParamGroup = params[1].split("^");

		html += '<div class="row">';
		html += '<div class="span4">';
		html += '<div class="row-fluid">';
		html += '<div class="offset3 span4 text-right">布局高度(px):</div>';
		html += '<div class="span2"><input type="text" class="form-control" id="layoutHeight" value="' + oTemplate.outerHeight() + '"></div>';
		html += '</div>';
		html += '</div>';
		html += '</div>';

		if (scaleParam.length > 0 && scaleParam.length == aLayout.length) {
			var reUnit = /(\D+)/g;
			var unit = scaleParam[0].match(reUnit);
			html += '<div class="row">';
			html += '<div class="span4">';
			html += '<div class="row-fluid">';
			html += '<div class="offset3 span4 text-right">选择单位:</div>';
			html += '<div class="offset1 span2">px <input type="radio" value="px" name="unit" ' + (unit == 'px' ? 'checked="checked"' : '') + '></div>';
			html += '<div class="span2">% <input type="radio" name="unit" value="%" ' + (unit == '%' ? 'checked="checked"' : '') + '></div>';
			html += '</div>';
			for (var i = 0, len = scaleParam.length; i < len; i++) {
				var val = parseInt(scaleParam[i]);
				var marginParam = marginParamGroup[i].split(",");
				var lcd = null,
					cell = null,
					oMargin = null,
					oBackground = null;
				if (layoutid in layoutCachedData) {
					lcd = layoutCachedData[layoutid];
					cell = lcd['cells'][i];
					oMargin = cell['margin'];
					oBackground = cell['background'];
				}
				html += '<div class="row-fluid">';
				html += '<div class="offset3 span4 text-right">列' + (i + 1) + '(<span class="unit">' + unit + '</span>):</div>';
				html += '<div class="span4"><input type="text" name="scale" class="form-control" value="' + val + '"></div>';
				html += '</div>';
				if (marginParam.length == 4) {
					html += '<div class="inp-mg-group">';
					html += '<div class="row-fluid">';
					html += '<div class="offset3 span6">边距设置(px):</div>';
					html += '</div>';
					html += '<div class="offset1 span5">';
					html += '上：<input type="text" name="inp-mg" class="inp-mg" value="' + (!lcd ? "0" : oMargin['top']) + '">';
					html += '下：<input type="text" name="inp-mg" class="inp-mg" value="' + (!lcd ? "0" : oMargin['bottom']) + '">';
					html += '左：<input type="text" name="inp-mg" class="inp-mg" value="' + (!lcd ? "0" : oMargin['left']) + '">';
					html += '右：<input type="text" name="inp-mg" class="inp-mg" value="' + (!lcd ? "0" : oMargin['right']) + '">';
					html += '</div>';
					html += '</div>';
				} else if (marginParam.length == 2) {
					html += '<div class="inp-mg-group">';
					html += '<div class="row-fluid">';
					html += '<div class="offset3 span6">边距设置(px):</div>';
					html += '</div>';
					html += '<div class="offset1 span5">';
					html += '上：<input type="text" name="inp-mg" class="inp-mg" value="0">';
					html += '下：<input type="text" name="inp-mg" class="inp-mg" value="0">';
					html += '左：<input type="text" name="inp-mg" class="inp-mg" value="0">';
					html += '右：<input type="text" name="inp-mg" class="inp-mg" value="0">';
					html += '</div>';
					html += '</div>';
				}
				var flag = aLayout.eq(i).attr('data-layout-param');
				if (flag) {
					if (flag.indexOf('bc') >= 0) {
						html += '<div class="row-fluid">';
						html += '<div class="offset3 span3 text-right">背景色:</div>';
						html += '<div class="span4"><input type="text" name="inp-bc" class="inp-bc" value="' + (!lcd ? '' : oBackground['color']) + '">';
						html += '</div>';

						// html += '<div class="span2"><input type="radio" name="inp-bc" class="inp-transparent" value="' + (!lcd ? '' : (oBackground['color'] == 'transparent' ? true : false)) + '">透明 ';
						// html += '</div>';

						html += '</div>';
					}

					if (flag.indexOf('bgi') >= 0) {
						html += '<div class="row-fluid">';
						html += '<div class="offset6 span3">背景图：<input type="file" id="upload_' + i + '" name="attr" class="form-control"></div>';
						html += '<div class="offset6 span5"><input type="checkbox" id="chkbox_'+ i +'" /> 清空背景图片</div>';
						html += '<div><input type="hidden" name="inp-bgi" class="form-control" value="' + (!lcd ? '' : oBackground['image']) + '"></div>';
						html += '</div>';
					}

					html += '<div class="offset1 span4"><hr></div>';
				}
			}

			html += '</div>';
			html += '</div>';


			footer = '<button class="btn btn-primary"> 确定 </button><button class="btn btn-default" data-dismiss="modal"> 取消 </button>';
			fnOK = function() {
				var oTemplate = $('#' + layoutid);
				var aLayout = oTemplate.children('.layout-row').children(".layout-cell");
				var oModal = $('#configModal');
				var $body = oModal.find('.modal-body');
				var layoutHeight = $('#layoutHeight').val();
				var scaleInputs = $body.find('input[name=scale]');
				var marginInputs = $body.find('input[name=inp-mg]');
				var bcInputs = $body.find('input[name=inp-bc]');
				var bgiInputs = $body.find('input[name=inp-bgi]');
				var inputUnit = $body.find('input[name=unit]');
				var unit = inputUnit.filter(':checked').val();

				var cellsConfig = [],
					elemData = {};
				//precheck
				var flag = false;
				if (unit == '%' || unit == 'px') {
					var sum = 0;
					$.each(scaleInputs, function(i) {
						if (!this.value) {
							this.value = 0;
						} else if (isNaN(this.value)) {
							alert('参数非法，请检查');
							flag = true;
							return;
						} else if (this.value < 0) {
							alert('参数非法，请检查');
							flag = true;
							return;
						}
						sum += parseInt(this.value);
						if (sum > 100) {
							if (unit == '%') {
								flag = true;
								return;
							} else if (unit == 'px' && sum > 1920) {
								flag = true;
								return;
							}

						}
					});


					$.each(marginInputs, function(i) {
						if (!this.value) {
							this.value = 0;
						} else if (isNaN(this.value)) {
							alert('参数非法，请检查');
							flag = true;
							return;
						} else if (this.value < 0) {
							alert('参数非法，请检查');
							flag = true;
							return;
						}
					});

					if (flag) {
						alert("参数非法，请检查");
						return;
					} else {
						var targetScaleParam = '',
							targetMaginParam = '';
						scaleInputs.each(function(index) {
							var config = {};
							var targetScaleValue = $(this).val() + unit;
							if (targetScaleParam != '') targetScaleParam += ',';
							targetScaleParam += targetScaleValue;

							var targetMarginValue = '';
							for (var j = 0; j < 4; j++) {
								var val = marginInputs.eq(index * 4 + j).val();
								if (j) val = ',' + val;
								targetMarginValue += val;
							}
							if (targetMaginParam != '') targetMaginParam += '^';
							targetMaginParam += targetMarginValue;

							var targetLayout = aLayout.eq(index);
							var originStyle = targetLayout.attr('style');
							var targetStyle = "";
							var styleArray = originStyle && originStyle.split(";");
							var test = {};
							if (styleArray) {
								for (var i = 0, len = styleArray.length; i < len; i++) {
									var p = styleArray[i].split(":");
									if (p.length == 2) {
										var attr = p[0],
											val = p[1];
										if (attr in test) {
											// do nothing
										} else {
											if (attr == 'min-height') {
												if (targetLayout.hasClass('lzh1')) {
													var minH = 240;
													if (!targetLayout.data('origin-minheight')) {
														targetLayout.data('origin-minheight', '240px');
													}
													var tarH = 120;
													if (targetScaleValue.indexOf('%') >= 0) {
														tarH = minH * parseInt(targetScaleValue) / 100;
													} else {
														tarH = parseInt(targetScaleValue);
													}
													targetStyle += "min-height:" + tarH + "px;";

												}
											} else if (attr == 'height') {
												targetStyle += "height:" + targetScaleValue + ";";
											} else if (attr == 'width') {
												targetStyle += "width:" + targetScaleValue + ";";
											} else {
												//targetStyle += attr + ":" + val + ";";
												//targetStyle += attr + ":" + targetScaleValue + ";";
											}
											test[attr] = val;
										}

									}
								}
							} else {
								// Conner case
								if (targetLayout.hasClass('lzh1')) {
									var iHeight = layoutHeight || targetLayout.closest('.layout-container').outerHeight();

									var tarH = targetLayout.outerHeight();

									if (targetScaleValue.indexOf('%') >= 0) {
										tarH = iHeight * parseInt(targetScaleValue) / 100;
									} else {
										tarH = parseInt(targetScaleValue);
									}
									targetStyle += "height:" + tarH + "px;";

									var pHeight = targetLayout.closest('.layout-container').outerHeight();
									var pLayout = targetLayout.parents('.layout-container').filter('[data-layer=0]');
									targetLayout.css({
										height: tarH + 'px'
									});

									pLayout.each(function() {
										$(this).css({
											height: pHeight + 'px'
										});
									});
								} else {
									targetStyle += "width:" + targetScaleValue + ";";
								}
							}

							var paddingTop = marginInputs.eq(index * 4 + 0).val() || 0;
							var paddingBottom = marginInputs.eq(index * 4 + 1).val() || 0;
							var paddingLeft = marginInputs.eq(index * 4 + 2).val() || 0;
							var paddingRight = marginInputs.eq(index * 4 + 3).val() || 0;
							// 因为用的是表格样式，这里用padding实现内间距
							targetStyle += 'padding-top:' + paddingTop + 'px;';
							targetStyle += 'padding-bottom:' + paddingBottom + 'px;';
							targetStyle += 'padding-left:' + paddingLeft + 'px;';
							targetStyle += 'padding-right:' + paddingRight + 'px';
							targetStyle += '!important;';
							targetLayout.attr('style', targetStyle);
							var bcVal = bcInputs.eq(index).val();
							if (bcVal && bcVal != null) {
								if (bcVal != 'transparent') {
									targetLayout.css({
										'background-color': '#' + bcVal
									});
								} else {
									if (!bgiInputs.eq(index).val()) {
										targetLayout.css({
											'background-color': 'transparent'
										});
									}
								}
							}

							var bgiVal = $('#chkbox_' + index).is(':checked') ? '' : bgiInputs.eq(index).val(),
								tlWidth = targetLayout.outerWidth(),
								tlHeight = $('#layoutHeight').val() || targetLayout.outerHeight(),
								styleString = 'background:url(/' + bgiVal + ') 0 0 no-repeat;background-size:' + tlWidth + 'px ' + tlHeight + 'px;';

							styleString += 'width:' + tlWidth + 'px;height:' + tlHeight + 'px;overflow:hidden;';

							if (bgiVal && bgiVal != null) {
								targetLayout.attr({
									style: styleString
								});
							}

							config = {
								margin: {
									left: paddingLeft,
									top: paddingTop,
									right: paddingRight,
									bottom: paddingBottom
								},
								background: {
									color: bcVal,
									image: bgiVal,
									position: '0 0',
									repeat: 'no-repeat',
									size: tlWidth + 'px ' + tlHeight + 'px'
								}
							};
							cellsConfig.push(config);
							//log(targetLayout.attr('style'));
						});

						oTemplate.attr('data-history-config', targetScaleParam + "$" + targetMaginParam);
						if (layoutHeight && !isNaN(layoutHeight)) {
							// do update function here

							updateLayoutHeight(oTemplate, layoutHeight);

							// oTemplate.css({
							// 	height: layoutHeight + 'px'
							// });

							// // trace back to the top level
							// var pLayout = oTemplate.parents('.layout-container').filter('[data-layer=0]');
							// pLayout.each(function() {
							// 	$(this).css({
							// 		height: layoutHeight + 'px'
							// 	});
							// });

						}

						elemData = {
							cells: cellsConfig
						};
						layoutCachedData[layoutid] = elemData;

						var cachedObj = {
							'id': layoutid,
							'height': layoutHeight,
							'data': elemData
						};
						oTemplate.attr('data-cache', JSON.stringify(cachedObj));

						//log(layoutCachedData);
						// setting background color;
						$('#configModal').modal('hide');
					}
				}

			};
			setupUpload = function() {
					var oModal = $('#configModal');
					var $modalBody = oModal.find('.modal-body');
					var $inputUnit = $modalBody.find('input[name=unit]');
					var $inputScale = $modalBody.find('input[name=scale]');
					var $inputBGColor = $modalBody.find('input[name=inp-bc]');
					var $inputBGImage = $modalBody.find('input[name=attr]');
					var $inputBGImageUrl = $modalBody.find('input[name=inp-bgi]');

					if ($inputScale.length > 1) {
						// Automatically finish the blanks
						$inputScale.first().on('keyup', function() {
							var obj = $modalBody.find('input[name=unit]:checked');
							if (obj.val() === 'px')
								return;

							var val = $(this).val();
							if (!isNaN(val) && val >= 0 && val <= 100) {
								var left = 100 - val;
								var avg = left / ($inputScale.length - 1);
								$modalBody.find('input[name=scale]').val(avg);
								$(this).val(val);
							}
						});

						if ($inputScale.length > 2) {
							$inputScale.eq(1).on('keyup', function() {
								var obj = $modalBody.find('input[name=unit]:checked');
								if (obj.val() === 'px')
									return;

								var first = $inputScale.first(),
									firstVal = +$(first).val(),
									thisVal = +$(this).val();

								if (!isNaN(firstVal) && !isNaN(thisVal) && firstVal >= 0 && firstVal <= 100 && thisVal >= 0 && (thisVal + firstVal) <= 100) {
									var left = 100 - firstVal - thisVal;
									var avg = left / ($inputScale.length - 2);
									$modalBody.find('input[name=scale]').val(avg);
									$(this).val(thisVal);
									$(first).val(firstVal);
								}
							});
						}

					}
					// Automatically calculate the scale in layout
					$inputUnit.each(function(index) {
						$(this).click(function() {
							var val = $(this).val();
							$inputUnit.eq(1 - index).removeAttr('checked');
							$('.unit').text(val);

							var sum4Layout = 0;
							$inputScale.each(function() {
								sum4Layout += parseInt($(this).val());
							});

							if (sum4Layout > 0) {
								if (val == '%') {
									$inputScale.each(function() {
										var pxVal = $(this).val();
										var target = Math.round((pxVal / sum4Layout) * 100);
										$(this).val(target);
									});
								} else if (val == 'px') {
									$inputScale.each(function(index) {
										var v = aLayout.eq(index).width();
										$(this).val(v);
									});
								}
							}

						});
					});

					$inputBGColor.each(function() {
						$(this).ColorPicker({
							onSubmit: function(hsb, hex, rgb, el) {
								$(el).val(hex);
								$(el).ColorPickerHide();
							},
							onBeforeShow: function() {
								$(this).ColorPickerSetColor(this.value);
							}
						}).on('keyup', function() {
							$(this).ColorPickerSetColor(this.value);
						});
					});

					var $cb = $.Callbacks();
					$inputBGImage.each(function(index) {
						var fn = function() {
							var id = '#upload_' + index;
							
							if ($(id).length) {
								try {
									$(id).uploadify('destroy');
								} catch (e) {
									log(e);
								} finally {
									$(id).uploadify({
										height: 30,
										buttonText: '<div class="row-fluid"><button class="btn btn-block btn-primary">上传背景图片</button></div>',
										swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
										uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=1',
										width: 200,
										'removeCompleted': false,
										'onUploadSuccess': function(file, data, response) {
											var res = $.parseJSON(data);
											$inputBGImageUrl.eq(index).val(res.url);
										},
										'onDestroy': function() {
											log('destroying');
										}
									});
								}
							}
						};

						$cb.add(fn);
					});

					$cb.fire();
				},
				fnCancel = function() {
					var oModal = $('#configModal');
					oModal.modal('hide');
				};
		}

	}

	return {
		body: html,
		footer: footer,
		onRenderReady: setupUpload,
		buttonFn: {
			fnOK: fnOK,
			fnCancel: fnCancel
		}
	};
}

function updateLayoutHeight(targetLayout, targetHeight) {
	updateSubLayoutHeight(targetLayout, targetHeight);
	//updateAncLayoutHeight(targetLayout, targetHeight);
}

/**
 * [updateAncLayoutHeight update all the ancestors's layout height when there contains a 'lzh1' type layout ]
 * @param  {[$element]} targetLayout [Current targetted layout]
 * @param  {[integer]} targetHeight [height to be set]
 * @return {[void]}              [description]
 */
function updateAncLayoutHeight(targetLayout, targetHeight) {
	// should be a template at least
	if (!targetLayout.hasClass('layout-container')) return;

	var newHeight = 0;
	var closestContext;
	var closestCell = targetLayout.closest('.layout-cell');
	var siblings = closestCell.siblings();
	// optimize this if there're no any vertical splitted layouts
	if (closestCell.hasClass('lzh1')) {
		var oParent = closestCell.closest('.layout-container');
		// update siblings layout if there contains 'lzh1' type layout	
		var sibHeight = 0;
		sibHeight = oParent.outerHeight() - closestCell.outerHeight();

		oParent.css({
			'height': +targetHeight + sibHeight,
			'min-height': +targetHeight + sibHeight
		});
		closestCell.css({
			'height': targetHeight,
			'min-height': targetHeight
		});

		closestCell.closest('.layout-row').css({
			'height': targetHeight,
			'min-height': targetHeight
		});;


		updateAncLayoutHeight(oParent, +targetHeight + sibHeight);

	} else {
		siblings.each(function() {
			// If any siblings contains vertical splitted layouts, 
			// need to update it in a top priority, or there will be ugly layout
			// showing in the page 
			var flag = $(this).find('.lzh1').length;
			if (flag) {
				var targetSubLayout = $(this).children('.layout-container');
				updateSubLayoutHeight(targetSubLayout, targetHeight);
			}
		});


		closestContext = closestCell.closest('.layout-container');
		if (closestContext && closestContext.length) {
			updateAncLayoutHeight(closestContext, targetHeight);
		}
	}

}

/**
 * [updateSubLayoutHeight update template layout recursivly]
 * @return {[type]} [void]
 */
function updateSubLayoutHeight(targetLayout, targetHeight) {
	// should be a template at least
	if (!targetLayout.hasClass('layout-container')) return;

	var oRow = targetLayout.children('.layout-row');
	// if (oRow.length) {
	// 	// fix lzh height first
	// 	var aCells = oRow.children('.layout-cell');
	// 	if(aCells.length && aCells.first().hasClass('lzh1')){
	// 		var sum = 0;
	// 		aCells.each(function(){
	// 			sum += $(this).outerHeight();
	// 		});

	// 		aCells.each(function(){
	// 			var scale = $(this).outerHeight() / sum;
	// 			var targetCellHeight = targetHeight * scale;

	// 			$(this).css({
	// 				'height' : targetCellHeight,
	// 				'min-height' :  targetCellHeight
	// 			});

	// 			$(this).closest('.layout-row').css({
	// 				'height' : targetCellHeight,
	// 				'min-height' :  targetCellHeight
	// 			});
	// 		});
	// 	}

	// 	aCells.each(function (){
	// 		var ctx = $(this).find('.layout-container');
	// 		if (ctx.length) {
	// 			updateSubLayoutHeight(ctx, targetHeight);
	// 		}
	// 	});
	// }
	targetLayout.css({
		'height': targetHeight + 'px',
		'min-height': targetHeight + 'px'
	});

	var targetMinHeight = targetHeight < 20 ? 20 : targetHeight;
	oRow.css({
		'height': targetHeight + 'px',
		'min-height': targetMinHeight + 'px'
	});
}

// Addiable Widget Panel
/**
 * [createAddiableWidgetPanel 构建可添加的部件面板]
 * @type {Object}
 */
var createAddiableWidgetPanel = {
	'navbar-list': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId),
			html = '';

		if (!elem.hasClass('widget-navbar')) {
			html += '<div class="row">';
			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right op_item" op_item="text">链接文字:</div>';
			html += '<div class="span1"><input type="text" class="form-control"></div>';
			html += '</div>';
			html += '</div>';

			html += '<div class="row">';
			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right op_item" op_item="href">链接地址:</div>';
			html += '<div class="span1"><input type="text" class="form-control"></div>';
			html += '</div>';
			html += '</div>';

			callback && $.isFunction(callback) && callback(html);
		} else {
			// normal navbar
			$.ajax({
				url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
				cache: false,
				async: true,
				type: "POST",
				data: {
					'siteId': $.trim($('#site').val())
				},
				success: function(result) {
					var res = $.parseJSON(result);
					var lastSiteId = res[0]['siteId'];
					html += '<form id="form1">';
					html += '<div class="row-fluid">';
					html += '<div class="offset2 span2 text-right">站点:</div>';
					html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
					for (var i = 0, len = res.length; i < len; i++) {
						var siteId = res[i]['siteId'];
						html += '<option value="' + siteId + '" >' + res[i]['siteName'] + '</option>';
					}
					html += '</select>';
					html += '</div></div>';

					html += '<div class="row-fluid">';
					html += '<div class="offset2 span2 text-right">栏目:</div>';
					$.ajax({
						url: ctxUrl + '/siteColumnController/getSiteColumn.do',
						cache: false,
						async: true,
						type: 'POST',
						data: {
							'siteId': lastSiteId
						},
						success: function(d) {
							var data = $.parseJSON(d);
							html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
							for (var i = 0, len = data.length; i < len; i++) {
								var columnId = data[i]['columnId'];
								html += '<option value="' + columnId + '" >' + data[i]['columnName'] + '</option>';
							}
							html += '</select>';
							html += '</div></div><br>';

							html += '</form>';
							html += '</div>';

							callback && $.isFunction(callback) && callback(html);
						}
					});
				}
			});
		}
	},
	'tab-panel': function(elemId, self, targetIndex, callback) {
		// 选项卡面板
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="text">链接文字:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="href">链接地址:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'asidenav': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="text">链接文字:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="href">链接地址:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'tab-menu': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="text">菜单名称:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'link-panel': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="text">链接文字:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="href">链接地址:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'imgchunk': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="link">链接:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="height">高度:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="backgroundColor">背景色:</div>';
		html += '<div class="span1"><input type="text" class="form-control" id="conf-bc"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'site-list': function(elemId, self, targetIndex, callback) {

	},
	'panel-list': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="title">栏目名称:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		html += '<div class="row">';
		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right op_item" op_item="link">链接:</div>';
		html += '<div class="span1"><input type="text" class="form-control"></div>';
		html += '</div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	}
};

// Editable Widget Panel
/**
 * [createWidgetPanel 构建可编辑的部件面板]
 * @type {Object}
 */
var createWidgetPanel = {
	'text,href': function(elemId, self, targetIndex, callback) {
		var elem = self,
			operable = ['text', 'href'],
			html = '',
			textDict = {
				'text': '文字',
				'href': '链接'
			};

		for (var i = 0; i < operable.length; i++) {
			html += '<div class="row-fluid">';
			html += '<div class="offset1 span2 text-right">' + textDict[operable[i]] + '：</div>';
			if (operable[i] == "text") {
				html += '<div class="span2"><input type="text" data-attrtype="title" class="form-control" value="' + $(elem).html() + '"></div>';
			} else {
				html += '<div class="span2"><input type="text" data-attrtype="href" class="form-control" value="' + $(elem).attr(operable[i]) + '"></div>';
			}
			html += '</div>';
		}
		html += '<div class="row-fluid">';
		html += '<div class="offset1 span2 text-right">大小：</div>';
		html += '<div class="span2"><input type="text" class="form-control" data-csstype="font-size" value="' + $(elem).css('font-size') + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset1 span2 text-right">颜色：</div>';
		html += '<div class="span2"><input type="text" class="form-control" data-csstype="color" value="' + Utils.rgb2hex($(elem).css('color')) + '"></div>';
		html += '</div>';
		callback && $.isFunction(callback) && callback(html);
	},
	'text': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId),
			html = '';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">文字：</div>';
		html += '<div class="span1"><input type="text" data-attrtype="title" class="form-control" value="' + $(elem).html() + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">大小：</div>';
		html += '<div class="span2"><input type="text" data-csstype="font-size" class="form-control" value="' + $(elem).css('font-size') + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">颜色：</div>';
		html += '<div class="span2"><input type="text" data-csstype="color" class="form-control" value="' + Utils.rgb2hex($(elem).css('color')) + '"></div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'float': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId),
			html = '';


		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">x坐标：</div>';
		html += '<div class="span1"><input type="text" id="left" class="form-control" value="' + parseInt($(elem).css('left')) + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">y坐标：</div>';
		html += '<div class="span1"><input type="text" id="top" class="form-control" value="' + parseInt($(elem).css('top')) + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset3 span3"><input type="file" id="upload" name="attr" class="form-control"></div>';
		html += '<div><input type="hidden" id="conf-url" name="url" class="form-control"></div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'querybar': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId),
			html = '';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">搜索地址：</div>';
		html += '<div class="span1"><input type="text" id="formAddr" class="form-control" value="' + ($(elem).find('form').attr('action') ? $(elem).find('form').attr('action') : '') + '"></div>';
		html += '</div>';
		callback && $.isFunction(callback) && callback(html);
	},
	'login': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId),
			html = '';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">提交地址：</div>';
		html += '<div class="span1"><input type="text" id="formAddr" class="form-control" value="' + ($(elem).find('form').attr('action') ? $(elem).find('form').attr('action') : '') + '"></div>';
		html += '</div>';
		callback && $.isFunction(callback) && callback(html);
	},
	'img-list': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">每行个数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">标题长度:</div>';
						html += '<div class="span3"><input type="text" id="btLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['btLength']) + '"></div>';
						html += '</div>';

						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'img-scroll-h': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">显示数量:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'flash': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row-fluid">';
		html += '<div class="offset3 span3"><input type="file" id="upload" name="attr" class="form-control"></div>';
		html += '<div><input type="hidden" id="conf-url" name="url" class="form-control"></div>';
		html += '</div><br>';

		callback && $.isFunction(callback) && callback(html);
	},
	'upload': function(elemId, self, targetIndex, callback) {
		var html = '';
		html += '<div class="row-fluid">';
		html += '<div class="offset3 span3"><input type="file" id="upload" name="attr" class="form-control"></div>';
		html += '<div><input type="hidden" id="conf-url" name="url" class="form-control"></div>';
		html += '</div><br>';

		callback && $.isFunction(callback) && callback(html);
	},
	'vote': function(elemId, self, targetIndex, callback) {
		$.ajax({
			url: '../suffrageController/getSuffrageList.do',
			type: "POST",
			cache: false,
			async: true,
			dataType: "text",
			success: function(data) {
				var html = '',
					wcd = null,
					dd = null,
					widget = null,
					d = $.parseJSON(data);

				if (elemId in widgetCachedData) {
					wcd = widgetCachedData[elemId];
					dd = wcd['data'];
					widget = dd['widget'];
				}

				html += '<div id="vote" class="row-fluid">';
				html += '<div class="offset2 span2 text-right">主题:</div>';
				html += '<div class="span4">';
				html += '<select id="voteSelect" class="form-control">';

				for (var i = 0, l = d.length; i < l; i++) {
					var opt = d[i],
						id = opt['id'];

					var selectString = !wcd ? '' : $.trim(id) == $.trim(widget['voteId']) ? 'selected' : '';
					html += '<option value="' + id + '" ' + selectString + '>' + opt['subject'] + '</option>';
				}
				html += '</select>';
				html += '</div>';
				html += '</div>';
				html += '</div>';

				callback && $.isFunction(callback) && callback(html);
			}
		});
	},
	'powerpoint': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						if (!elem.hasClass('marquee')) {
							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">条数:</div>';
							html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
							html += '</div>';

							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">长度:</div>';
							html += '<div class="span3"><input type="text" id="siteLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
							html += '</div>';
						} else {
							html += '<div class="row-fluid">';
							html += '<input type="hidden" id="siteCount" name="count" class="form-control" value="15">';
							html += '<input type="hidden" id="siteLength" name="length" class="form-control" value="15">';
							html += '</div>';
						}

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'navbar': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			widgetData = null,
			siteid = $.trim($('#site').val()),
			target = self,
			dataIndex = -1;

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'],
				widget = data['widget'],
				dataIndex = target.attr('data-index');

			if (dataIndex && +dataIndex !== -1) {
				widgetData = widget[dataIndex];
				siteid = widgetData['siteId'];
			}
		}

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !widgetData ? '' : (widgetData['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);
						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !widgetData ? '' : (!widgetData['siteColumnId'] ? '' : (widgetData['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div><br>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'panel': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			listStyle,
			underline,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'],
				listStyle = widget['listStyleType'],
				underline = widget['underlineType'];
		};

		var fnNormal = function () {
			$.ajax({
				url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
				cache: false,
				async: true,
				type: "POST",
				data: {
					'siteId': siteid
				},
				success: function(result) {
					var res = $.parseJSON(result);
					var lastSiteId = res[0]['siteId'];
					html += '<form id="form1">';
					html += '<div class="row-fluid">';
					html += '<div class="offset2 span2 text-right">站点:</div>';
					html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
					for (var i = 0, len = res.length; i < len; i++) {
						var siteId = res[i]['siteId'];
						var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
						if (selectedString !== '') {
							lastSiteId = siteId;
						}
						html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
					}
					html += '</select>';
					html += '</div></div>';

					html += '<div class="row-fluid">';
					html += '<div class="offset2 span2 text-right">栏目:</div>';
					$.ajax({
						url: ctxUrl + '/siteColumnController/getSiteColumn.do',
						cache: false,
						async: true,
						type: 'POST',
						data: {
							'siteId': lastSiteId
						},
						success: function(d) {
							var data = $.parseJSON(d);
							html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
							for (var i = 0, len = data.length; i < len; i++) {
								var columnId = data[i]['columnId'];
								var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
								html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
							}
							html += '</select>';
							html += '</div></div>';

							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">条数:</div>';
							html += '<div class="span3"><input type="text" id="siteCount" name="siteCount" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
							html += '</div>';

							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">长度:</div>';
							html += '<div class="span3"><input type="text" id="siteLength" name="siteLength" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
							html += '</div>';

							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">时间:</div>';
							html += '<div class="span3"><select name="date" id="siteTime">';
							html += '<option value="" selected></option>';
							html += '<option value="yyyy-MM-dd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy-MM-dd" ? "selected" : ""))) + '>2014-01-01</option>';
							html += '<option value="MM-dd" ' + (!wcd ? "selected" : (widget['siteTime'] == "MM-dd" ? "selected" : "")) + '>01-01</option>';
							html += '<option value="yyyy年MM月dd日" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy年MM月dd日" ? "selected" : ""))) + '>2014年01月01日</option>';
							html += '<option value="yyyyMMdd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyyMMdd" ? "selected" : ""))) + '>20140101</option>';
							html += '</select></div>';
							html += '</div><br>';
							html += '</form>';
							html += '</div>';


							// 加入bootstrap下拉菜单，　添加项目符号和底部线条的配置项
							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">项目符号:</div>';
							html += '<div class="span5">';
							html += '<div class="dropdown" data-style="' + listStyle + '">';
							html += '<button type="button" class="btn dropdown-toggle" id="dropdownListStyle" data-toggle="dropdown">';
							html += '符号类型';
							html += '<span class="caret"></span>';
							html += '</button>';
							html += '<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownListStyle">';

							html += '<li role="presentation" >';
							html += '<a role="menuitem" tabindex="-1" data-type="disc" href="#">';
							html += '实心圆';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="circle" href="#">';
							html += '空心圆';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="square" href="#">';
							html += '实心方块';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="decimal" href="#">';
							html += '递增数字';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" data-type="decimalLz" tabindex="-1" href="#">';
							html += '递增数字（前导零）';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" data-type="undefined" tabindex="-1" href="#">';
							html += '无样式';
							html += '</a>';
							html += '</li>';

							html += '</ul>';
							html += '</div>';


							html += '</div>';
							html += '</div><br>'; // End toggle menu for item sign style



							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">底部线条:</div>';
							html += '<div class="span5">';

							html += '<div class="dropdown" data-style="' + underline + '">';
							html += '<button type="button" class="btn dropdown-toggle" id="dropdownUnderline" data-toggle="dropdown">';
							html += '线条类型';
							html += '<span class="caret"></span>';
							html += '</button>';
							html += '<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownUnderline">';

							html += '<li role="presentation" >';
							html += '<a role="menuitem" tabindex="-1" data-type="solid" href="#">';
							html += '实线 ━━━━━━━━━  ';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="dashed" href="#">';
							html += '虚线 -----------------------  ';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="dotted" href="#">';
							html += '点线 ............................  ';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="double" href="#">';
							html += '双线 ===========  ';
							html += '</a>';
							html += '</li>';

							html += '<li role="presentation">';
							html += '<a role="menuitem" tabindex="-1" data-type="undefined" href="#">';
							html += '无样式';
							html += '</a>';
							html += '</li>';

							html += '</ul>';
							html += '</div>';

							html += '</div>';
							html += '</div><br>'; // End toggle menu for bottom line style

							callback && $.isFunction(callback) && callback(html);
						}
					});
				}
			});
		};

		var fnHook = function () {
			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right">条数:</div>';
			html += '<div class="span3"><input type="text" id="siteCount" name="siteCount" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
			html += '</div>';

			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right">长度:</div>';
			html += '<div class="span3"><input type="text" id="siteLength" name="siteLength" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
			html += '</div>';

			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right">时间:</div>';
			html += '<div class="span3"><select name="date" id="siteTime">';
			html += '<option value="" selected></option>';
			html += '<option value="yyyy-MM-dd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy-MM-dd" ? "selected" : ""))) + '>2014-01-01</option>';
			html += '<option value="MM-dd" ' + (!wcd ? "selected" : (widget['siteTime'] == "MM-dd" ? "selected" : "")) + '>01-01</option>';
			html += '<option value="yyyy年MM月dd日" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy年MM月dd日" ? "selected" : ""))) + '>2014年01月01日</option>';
			html += '<option value="yyyyMMdd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyyMMdd" ? "selected" : ""))) + '>20140101</option>';
			html += '</select></div>';
			html += '</div><br>';
			html += '</form>';
			html += '</div>';


			// 加入bootstrap下拉菜单，　添加项目符号和底部线条的配置项
			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right">项目符号:</div>';
			html += '<div class="span5">';
			html += '<div class="dropdown" data-style="' + listStyle + '">';
			html += '<button type="button" class="btn dropdown-toggle" id="dropdownListStyle" data-toggle="dropdown">';
			html += '符号类型';
			html += '<span class="caret"></span>';
			html += '</button>';
			html += '<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownListStyle">';

			html += '<li role="presentation" >';
			html += '<a role="menuitem" tabindex="-1" data-type="disc" href="#">';
			html += '实心圆';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="circle" href="#">';
			html += '空心圆';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="square" href="#">';
			html += '实心方块';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="decimal" href="#">';
			html += '递增数字';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" data-type="decimalLz" tabindex="-1" href="#">';
			html += '递增数字（前导零）';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" data-type="undefined" tabindex="-1" href="#">';
			html += '无样式';
			html += '</a>';
			html += '</li>';

			html += '</ul>';
			html += '</div>';


			html += '</div>';
			html += '</div><br>'; // End toggle menu for item sign style



			html += '<div class="row-fluid">';
			html += '<div class="offset2 span2 text-right">底部线条:</div>';
			html += '<div class="span5">';

			html += '<div class="dropdown" data-style="' + underline + '">';
			html += '<button type="button" class="btn dropdown-toggle" id="dropdownUnderline" data-toggle="dropdown">';
			html += '线条类型';
			html += '<span class="caret"></span>';
			html += '</button>';
			html += '<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownUnderline">';

			html += '<li role="presentation" >';
			html += '<a role="menuitem" tabindex="-1" data-type="solid" href="#">';
			html += '实线 ━━━━━━━━━  ';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="dashed" href="#">';
			html += '虚线 -----------------------  ';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="dotted" href="#">';
			html += '点线 ............................  ';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="double" href="#">';
			html += '双线 ===========  ';
			html += '</a>';
			html += '</li>';

			html += '<li role="presentation">';
			html += '<a role="menuitem" tabindex="-1" data-type="undefined" href="#">';
			html += '无样式';
			html += '</a>';
			html += '</li>';

			html += '</ul>';
			html += '</div>';

			html += '</div>';
			html += '</div><br>'; // End toggle menu for bottom line style

			callback && $.isFunction(callback) && callback(html);
		};


		var hookFlag = $('#' + elemId).attr('data-hooks');
		if (hookFlag && hookFlag == 'list' || hookFlag == 'cont') {
			fnHook();
		} else {
			fnNormal();
		}
	},
	'attrlist': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="siteCount" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">标题长度:</div>';
						html += '<div class="span3"><input type="text" id="siteLength" name="siteLength" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
						html += '</div>';


						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">时间:</div>';
						html += '<div class="span3"><select name="date" id="siteTime">';
						html += '<option value="" '+ (!wcd ? 'selected' : '') +'></option>';
						html += '<option value="yyyy-MM-dd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy-MM-dd" ? "selected" : ""))) + '>2014-01-01</option>';
						html += '<option value="MM-dd" ' + (!wcd ? "selected" : (widget['siteTime'] == "MM-dd" ? "selected" : "")) + '>01-01</option>';
						html += '<option value="yyyy年MM月dd日" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy年MM月dd日" ? "selected" : ""))) + '>2014年01月01日</option>';
						html += '<option value="yyyyMMdd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyyMMdd" ? "selected" : ""))) + '>20140101</option>';
						html += '</select></div>';
						html += '</div><br>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'img-news': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">内容长度:</div>';
						html += '<div class="span3"><input type="text" id="nrLength" name="nrlength" class="form-control" value="' + (!wcd ? '' : widget['nrLength']) + '"></div>';
						html += '</div>';

						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'img-news-v': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="siteCount" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">标题长度:</div>';
						html += '<div class="span3"><input type="text" id="btLength" name="btlength" class="form-control" value="' + (!wcd ? '' : widget['btLength']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">内容长度:</div>';
						html += '<div class="span3"><input type="text" id="nrLength" name="nrlength" class="form-control" value="' + (!wcd ? '' : widget['nrLength']) + '"></div>';
						html += '</div>';

						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'img-news-h': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="siteCount" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">标题长度:</div>';
						html += '<div class="span3"><input type="text" id="btLength" name="btlength" class="form-control" value="' + (!wcd ? '' : widget['btLength']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">内容长度:</div>';
						html += '<div class="span3"><input type="text" id="nrLength" name="nrlength" class="form-control" value="' + (!wcd ? '' : widget['nrLength']) + '"></div>';
						html += '</div>';

						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'news-group': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">标题长度:</div>';
						html += '<div class="span3"><input type="text" id="btLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['btLength']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">内容长度:</div>';
						html += '<div class="span3"><input type="text" id="nrLength" name="nrlength" class="form-control" value="' + (!wcd ? '' : widget['nrLength']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'site-list': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val());

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
				data = wcd['data'],
				widget = data['widget'],
				siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': siteid
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);
						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						html += '<option value=""></option>';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">子栏目数:</div>';
						html += '<div class="span3"><input type="text" id="subSiteCount" name="ssCount" class="form-control" value="' + (!wcd ? '' : widget['subSiteCount']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'easyslides': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'slidenormal': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">长度:</div>';
						html += '<div class="span3"><input type="text" id="siteLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'slidetop': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">长度:</div>';
						html += '<div class="span3"><input type="text" id="siteLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'bot_ppt': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">条数:</div>';
						html += '<div class="span3"><input type="text" id="siteCount" name="count" class="form-control" value="' + (!wcd ? '' : widget['siteCount']) + '"></div>';
						html += '</div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">长度:</div>';
						html += '<div class="span3"><input type="text" id="siteLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['siteLength']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'digest': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';


						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">摘要长度:</div>';
						html += '<div class="span3"><input type="text" id="nrLength" name="length" class="form-control" value="' + (!wcd ? '' : widget['nrLength']) + '"></div>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'article-title': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'article-author': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'article-share': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'article-date': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '<div class="row-fluid">';
						html += '<div class="offset2 span2 text-right">时间格式:</div>';
						html += '<div class="span3"><select name="date" id="siteTime">';
						html += '<option value="" '+ (!wcd ? 'selected' : '') +'></option>';
						html += '<option value="yyyy-MM-dd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy-MM-dd" ? "selected" : ""))) + '>2014-01-01</option>';
						html += '<option value="MM-dd" ' + (!wcd ? "selected" : (widget['siteTime'] == "MM-dd" ? "selected" : "")) + '>01-01</option>';
						html += '<option value="yyyy年MM月dd日" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyy年MM月dd日" ? "selected" : ""))) + '>2014年01月01日</option>';
						html += '<option value="yyyyMMdd" ' + (!wcd ? "" : (!widget['siteTime'] ? "" : (widget['siteTime'] == "yyyyMMdd" ? "selected" : ""))) + '>20140101</option>';
						html += '</select></div>';
						html += '</div><br>';
						html += '</div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'article-contents': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		$.ajax({
			url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
			cache: false,
			async: true,
			type: "POST",
			data: {
				'siteId': $.trim($('#site').val())
			},
			success: function(result) {
				var res = $.parseJSON(result);
				var lastSiteId = res[0]['siteId'];
				html += '<form id="form1">';
				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">站点:</div>';
				html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
				for (var i = 0, len = res.length; i < len; i++) {
					var siteId = res[i]['siteId'];
					var selectedString = !wcd ? '' : (widget['siteId'] == siteId ? 'selected' : '');
					if (selectedString !== '') {
						lastSiteId = siteId;
					}
					html += '<option value="' + siteId + '" ' + selectedString + '>' + res[i]['siteName'] + '</option>';
				}
				html += '</select>';
				html += '</div></div>';

				html += '<div class="row-fluid">';
				html += '<div class="offset2 span2 text-right">栏目:</div>';
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': lastSiteId
					},
					success: function(d) {
						var data = $.parseJSON(d);

						html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
						for (var i = 0, len = data.length; i < len; i++) {
							var columnId = data[i]['columnId'];
							var selectedString = !wcd ? '' : (!widget['siteColumnId'] ? '' : (widget['siteColumnId'] == columnId ? 'selected' : ''));
							html += '<option value="' + columnId + '" ' + selectedString + '>' + data[i]['columnName'] + '</option>';
						}
						html += '</select>';
						html += '</div></div>';

						html += '</form>';
						html += '</div>';

						callback && $.isFunction(callback) && callback(html);
					}
				});
			}
		});
	},
	'countdown': function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null,
			siteid = $.trim($('#site').val()),
			elem = self || $('#' + elemId);

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId];
			data = wcd['data'];
			widget = data['widget'];
			siteid = widget['siteId'];
		};

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">事件名称:</div>';
		html += '<div class="span3"><input type="text" id="eventName" name="eventName" class="form-control" value="' + (!wcd ? '' : widget['eventName']) + '"></div>';
		html += '</div>';

		html += '<div class="row-fluid">';
		html += '<div class="offset2 span2 text-right">结束时间:</div>';
		html += '<div class="span3"><input type="text" id="endDate" placeholder="yyyy-MM-dd" name="endDate" class="form-control" value="' + (!wcd ? '' : widget['endDate']) + '"></div>';
		html += '</div>';

		callback && $.isFunction(callback) && callback(html);
	},
	'nav-auto' : function(elemId, self, targetIndex, callback) {
		var html = '',
			wcd = null,
			data = null,
			widget = null;

		if (elemId in widgetCachedData) {
			wcd = widgetCachedData[elemId],
			data = wcd['data'],
			widget = data['widget'];
		};


		var sites = defaultData['sites'];
		var siteColumns = defaultData['siteColumns'];
		var counter = 0;

		html += '<h6>选择站点</h6>';
		html += '<select name="siteArray" class="multiselect">';
		$.each(sites, function (i, site){
			html += '<option value="'+ site['siteId'] +'" data-siteid="'+ site['siteId'] +'">';
			html += site['siteName'];
			html += '</option>';
			counter++;
		});
		html += '</select>';


		
		$.each(sites, function (i, site){
			$.ajax({
				url : ctxUrl + '/siteColumnController/getSiteColumn.do?&t=' + Math.random(),
				type : 'POST',
				dataType : 'json',
				data : {
					siteId : site['siteId']
				},
				cache : false,
				success : function (data){
					if (!defaultData['siteColumns']) {
						defaultData['siteColumns'] = {};
					}

					defaultData['siteColumns'][site['siteId']] = data;
					
					if (--counter === 0) {
						siteColumns = defaultData['siteColumns'];
						
						var timeoutFn = function (){
							html += '<h6>选择栏目</h6>';

							html += '<select class="multiselect" name="siteColumnArray" multiple="multiple">';
							$.each(sites, function (i, site) {
								html += '<optgroup data-siteid="'+ site['siteId'] +'" label="'+ site['siteName'] +'">'
								
								var siteColumnArray = siteColumns[site['siteId']];
								$.each(siteColumnArray, function (j, column){
									html += '<option value="'+ column['columnId'] +'" data-columnid="' + column['columnId'] +'" disabled>'+ column['columnName'] +'</option>';
								});

								html += '</optgroup>';
							});

							html += '</select>';
							callback && $.isFunction(callback) && callback(html);
						};

						timeoutFn();
					}
				},
				error : function (){

				}
			});

		});
	},
	'weather': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'date': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'navbar-list': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'chunk': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'location': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'imgchunk': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'scroll-h': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'asidenav': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	},
	'footer': function(elemId, self, targetIndex, callback) {
		callback && $.isFunction(callback) && callback('');
	}
};

var proxyCreateWidgetExtraConfig = function(elemId, self, callback) {
	var elem = self ? self : $('#' + elemId),
		ext = elem.attr('data-widget-param'),
		html = '';

	// Some basic params is allowed to be reset
	if (ext) {
		// w --> width, h --> height, bc --> background-color, bgi --> background-image
		var params = ext.split(';');
		//history configurations
		var historyConfig = elem.attr('data-history-config');
		var configJson = Utils.parseKV2Json(historyConfig);
		for (var i = 0, len = params.length; i < len; i++) {
			var param = params[i];
			if (param) {
				// row started
				html += '<div class="row">';
				html += '<div class="row-fluid">';
				if ('link' === param) {
					html += '<div class="offset2 span2 text-right">链接:</div>';
					html += '<div class="span3"><input type="text" id="conf-link" class="form-control" value="' + configJson['link'] + '"></div>';
				} else if ('width' === param) {
					html += '<div class="offset2 span2 text-right">宽度:</div>';
					html += '<div class="span3"><input type="text" id="conf-width" class="form-control" value="' + configJson['width'] + '"></div>';
				} else if ('height' === param) {
					html += '<div class="offset2 span2 text-right">高度:</div>';
					html += '<div class="span3"><input type="text" id="conf-height" class="form-control" value="' + configJson['height'] + '"></div>';
				} else if ('bc' === param) {
					html += '<div class="offset2 span2 text-right">背景色:</div>';
					html += '<div class="span3">';
					html += '<input type="text" id="conf-bc" class="form-control" value="' + configJson['bc'] + '">';
					html += '<input type="checkbox" id="conf-bc-transparent" name="inp-bc" class="form-control" value="transparent" ' + (configJson['bc'] == 'transparent' ? 'checked' : '') + '>透明背景';
					html += '<br></div>';
				} else if ('bgi' === param) {
					html += '<div class="row-fluid">';
					html += '<div class="offset4 span3"><input type="file" id="upload" name="attr" class="form-control" value=""></div>';
					html += '<div><input type="hidden" id="conf-bgi" name="inp-bgi" class="form-control"></div>';
					html += '</div>';
				} else if ('bgr' === param) {
					html += '<div class="offset2 span2 text-right">背景重复:</div>';
					html += '<div class="span6"><input type="radio" name="inp-bgr" class="form-control" value="no-repeat" ' + (configJson['bgr'] == 'no-repeat' ? 'checked' : '') + '>否  ';
					html += '<input type="radio" name="inp-bgr" class="form-control" value="repeat" ' + (configJson['bgr'] == 'repeat' ? 'checked' : '') + '>是  ';
					html += '<input type="radio" name="inp-bgr" class="form-control" value="repeat-x" ' + (configJson['bgr'] == 'repeat-x' ? 'checked' : '') + '>X-重复  ';
					html += '<input type="radio" name="inp-bgr" class="form-control" value="repeat-y" ' + (configJson['bgr'] == 'repeat-y' ? 'checked' : '') + '>Y-重复  ';
					html += '</div>';
				} else if ('nb' === param) {
					$.ajax({
						url: ctxUrl + '/siteController/getSite.do?t=' + Math.random(),
						cache: false,
						async: true,
						type: "POST",
						data: {
							'siteId': $.trim($('#site').val())
						},
						success: function(result) {
							var res = $.parseJSON(result);
							html += '<form id="form1">';
							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">站点:</div>';
							html += '<div class="span3"><select id="site" name="site" onchange="changeSite()">';
							for (var i = 0, len = res.length; i < len; i++) {
								html += '<option value="' + res[i]['siteId'] + '">' + res[i]['siteName'] + '</option>';
							}
							html += '</select>';
							html += '</div></div>';

							html += '<div class="row-fluid">';
							html += '<div class="offset2 span2 text-right">栏目:</div>';
							$.ajax({
								url: ctxUrl + '/siteColumnController/getSiteColumn.do',
								cache: false,
								async: true,
								type: 'POST',
								data: {
									'siteId': res[0]['siteId']
								},
								success: function(d) {
									var data = $.parseJSON(d);
									html += '<div class="span3"><select id="siteColumn" name="siteColumn">';
									for (var i = 0, len = data.length; i < len; i++) {
										html += '<option value="' + data[i]['columnId'] + '">' + data[i]['columnName'] + '</option>';
									}
									html += '</select>';
									html += '</div></div>';

									html += '</form>';
									html += '</div>';
								}
							});
						}
					});
				}

				// row ended
				html += '</div>';
				html += '</div>';
			}
		}
	}
	callback && $.isFunction(callback) && callback(html);
};

/* This uses proxy pattern to create a widget config panel which return a formatted html code */
var proxyCreateWidgetPanel = function(type, elemId, self, todo, targetIndex, callback) {
	var html = '';

	if (todo && todo === 'append') {
		createAddiableWidgetPanel[type](elemId, self, targetIndex, function(fragment) {
			callback && $.isFunction(callback) && callback(fragment);
		});
	} else {
		if (!(type in createWidgetPanel)) return;
		createWidgetPanel[type](elemId, self, targetIndex, function(fragment) {
			//异步
			html = fragment;
			//无ajax请求，直接添加即可
			proxyCreateWidgetExtraConfig(elemId, self, function(extra) {
				html += extra;
				callback && $.isFunction(callback) && callback(html);
			});
		});
	}
};

/* 清理使用过后的模态窗口 */
function modalCleanUp(e) {
	try {
		$("#upload").uploadify('destroy');
	} catch (e) {};

	var oModal = $('#configModal');
	var $modalBody = oModal.find('.modal-body');
	oModal.modal('hide');
	$modalBody.empty();
}

/* 额外配置参数的实现 */
function extraFn(fnType, elemId, self) {
	var history = '',
		link = '',
		width = '',
		height = '',
		bgcolor = '',
		bgimage = '',
		bgrepeat = '',
		flag = !1,
		elem = self || $('#' + elemId);

	if ($('#conf-link').length)
		link = $.trim($('#conf-link').val());

	if ($('#conf-width').length)
		width = $.trim($('#conf-width').val());

	if ($('#conf-height').length)
		height = $.trim($('#conf-height').val());

	if ($('#conf-bc').length) {
		if ($('#conf-bc-transparent').prop('checked')) {
			bgcolor = $.trim($('#conf-bc-transparent').val());
		} else {
			bgcolor = $.trim($('#conf-bc').val());
		}
	}

	if ($('#conf-bgi').length)
		bgimage = $.trim($('#conf-bgi').val());

	//console.log($('input[name=inp-bgr]:checked'));
	if ($('input[name=inp-bgr]:checked').length)
		bgrepeat = $.trim($('input[name=inp-bgr]:checked').val());

	//validate parameters
	(function(a, b, c, d, e) {
		var are = /([\w-]+\.)+[\w-]+([\w-.?\%\&\=]*)?/gi;
		var bre = /\d+/gi;
		var cre = /\d+/gi;
		var dre = /\#[0-9a-fA-F]{6}/gi;
		var ere = /\.(bmp|jpg|gif|jpeg)$/gi;
		var errorMessage = '参数非法，请检查';


	})(link, width, height, bgcolor, bgimage);

	if (flag) {
		return false;
	}

	if (link)
		history += 'link=' + link + ";";

	if (width)
		history += 'width=' + width + ";";

	if (height)
		history += 'height=' + height + ";";

	if (bgcolor)
		history += 'bc=' + bgcolor + ";";

	if (bgimage)
		history += 'bgi=' + bgimage + ";";

	if (bgrepeat)
		history += 'bgr=' + bgrepeat + ";";

	//为部件写入配置参数
	elem.attr('data-history-config', history);
	var tE = elem,
		titleFlag = false;
	if (elem.find('[class$=title]').length) {
		tE = elem.find('[class$=title]');
		if (tE.hasClass('powerpoint-title')) {
			tE = elem;
		}
		titleFlag = true;
	}

	if (width && height) {
		var oW = tE.outerWidth();
		var oH = tE.outerHeight();

		if (width.indexOf('%') == -1 && height.indexOf('%') == -1) {
			var pW = parseInt(width) + 'px',
				pH = parseInt(height) + 'px';

			elem.css({
				'width': pW
			});

			tE.attr({
				"style": 'width:' + pW + ';height:' + pH + ' !important;'
			});

			//fix title line-height
			if (titleFlag) {
				// tackle with no-header-title case
				tE.find('[desc=title]').css('line-height', pH + 'px');
				tE.find('a').css('line-height', pH + 'px');
			}

		} else {
			// for the percentage
			var tarW = parseInt(width),
				tarH = parseInt(height);

			tarW += width.indexOf('%') >= 0 ? '%' : 'px';
			tarH += height.indexOf('%') >= 0 ? '%' : 'px';


			elem.css({
				'width': tarW
			});

			tE.css({
				'width' : tarW
			}).attr({
				"style": 'height:' + tarH + ' !important;'
			});
			//fix title line-height
			if (titleFlag) {
				tE.find('[desc=title]').css('line-height', tE.outerHeight() + 'px');
				tE.find('a').css('line-height', tE.outerHeight() + 'px');
			}
		}
	} else {
		if (height) {
			var tarH = height.indexOf('%') >= 0 ? height : parseInt(height) + 'px';
			tarH = height == 'auto' ? 'auto' : tarH;

			//仅有可能对高度进行修改
			tE.css({
				height: tarH
			});

			//fix title line-height
			if (titleFlag) {
				tE.find('[desc=title]').css('line-height', tE.outerHeight() + 'px');
				tE.find('a').css('line-height', tE.outerHeight() + 'px');
			}
		}

		if (width) {
			var tarW = width.indexOf('%') >= 0 ? width : parseInt(height) + 'px';
			tarW = width == 'auto' ? 'auto' : tarW;
			elem.css({
				width: tarW
			});
		}
	}

	if (bgcolor) {
		if (bgcolor.indexOf('#') < 0) {
			if (bgcolor != 'transparent') {
				bgcolor = '#' + bgcolor;
			}
		}
		// only header need to change the background color

		tE.css('background-color', bgcolor);
		if (elem.find('.arrow-down').length) {
			elem.find('.arrow-down').css({
				'border-color': '#fff ' + bgcolor + ' transparent ' + bgcolor
			});
		}
	}

	//Change image bgi and size
	var imgUrl = $('#conf-url').val();
	if (imgUrl) {
		if (fnType == 'upload' || fnType == 'panel' || fnType == 'navbar-list' || fnType.indexOf('panel') >= 0) {
			var elW, elH;
			elW = elem.outerWidth(),
				elH = elem.outerHeight();
			if (fnType == 'upload') {
				elW = width || elem.outerWidth(),
					elH = height || elem.outerHeight();
			}

			var bg = 'background:url(/' + imgUrl + ') 0 0 no-repeat;background-size:' + elem.outerWidth() + 'px ' + elem.outerHeight() + 'px !important;';

			if ($('input[name=inp-bgr]:checked').length) {
				bg += 'background-repeat:' + bgrepeat + ';';
			}
			var originStyle = tE.attr('style');
			tE.attr({
				style: originStyle + ";" + bg
			});
		} else if (fnType == 'flash') {
			var config = elem.data('history-config');
			if (config) {
				elem.attr("data-history-config", config + ";" + "link=" + imgUrl);
			} else {
				elem.attr("data-history-config", "link=" + imgUrl);
			}
		}

		if(fnType == 'upload'){
			elem.html('');
		}
	} else {
		var bgiUrl = $('#conf-bgi').val();
		var eW = tE.outerWidth(),
			eH = tE.outerHeight();
		if (!bgiUrl) {
			if (bgcolor) {
				if (bgcolor.indexOf('#') < 0) {
					bgcolor = '#' + bgcolor;
				}
				// only header need to change the background color

				tE.css('background-color', bgcolor);
				if (elem.find('.arrow-down').length) {
					elem.find('.arrow-down').css({
						'border-color': '#fff ' + bgcolor + ' transparent ' + bgcolor
					});
				}
			}
		} else {

			if (fnType == 'footer' || fnType == 'vote' || fnType == 'imgchunk' || fnType == 'chunk' || fnType == 'link-panel' || fnType == 'panel' || fnType == 'navbar-list' || fnType == 'date' || fnType == 'weather' || fnType.indexOf('panel') >= 0) {
				var bg = 'background:url(/' + bgiUrl + ') 0 0 no-repeat;';
				if (fnType != 'navbar-list') {
					bg += 'background-size:cover;';
				}

				if ($('input[name=inp-bgr]:checked').length) {
					bg += 'background-repeat:' + bgrepeat + ';';
				}
				var originStyle = tE.attr('style');

				tE.attr({
					style: originStyle + ";" + bg
				});
			}
		}
	}



	/* 返回部件设置的额外设置值 */
	return {
		link: link,
		width: width,
		height: height,
		bgcolor: bgcolor,
		bgimage: bgimage,
		bgrepeat: bgrepeat
	};
}

/* 提供全局json和button事件，以及相应的重置方法 */
var widgetConfig, //部件缓存参数
	extraConfig, //部件额外参数
	elemData, // 待写入部件缓存的json
	setupUpload, // 文件上传前的准备工作
	fnOK, // 确认配置
	fnCancel, // 取消配置
	fnUpload; // 开始上传

var resetReadyFNVars = function() {
	//GC([widgetConfig, extraConfig, elemData]);

	if (!widgetConfig)
		widgetConfig = {};

	if (!extraConfig)
		extraConfig = {};

	if (!elemData)
		elemData = {};

	setupUpload = null,
		fnOK = null,
		fnCancel = null,
		fnUpload = null;
};

/**
 * [GC 一个简单的gc， 基于dfs的垃圾收集器，未考虑优化(可以Scavenge和Mark-Sweep/Mark-Compact实现)]
 * @param {[type]} arr [需要进行gc的对象数组]
 */
var GC = function(arr) {
	for (var i = 0, l = arr.length; i < l; i++) {
		clean.call(this, arr[i]);
	}
}

/**
 * [clean DFS cleaner, 深度优先的垃圾回收器]
 * @param  {[Object]} obj [需要进行内存回收的对象]
 * @return {[void]}     [description]
 */
function clean(obj) {
	if (!obj) return;

	for (var i in obj) {
		if (obj.hasOwnProperty(i)) {
			if (typeof obj[i] === 'object') {
				clean(obj[i]);
			}
			//console.log('cleaning--->' + i);
			delete obj[i];
		}
	}
	obj = null;
}

/* 采用策略模式重写配置面板渲染完成后的事件监听函数 */
var createAddiableReadyFN = function(type, elemId, self, targetIndex, callback) {
	resetReadyFNVars();
	addiableReadyFNStrategies[type](elemId, self, targetIndex);
	var obj = {
		onRenderReady: function() {
			if (setupUpload && $.isFunction(setupUpload)) {
				setupUpload();
			}

			if ($('#conf-bc').length) {
				$('#conf-bc').ColorPicker({
					onSubmit: function(hsb, hex, rgb, el) {
						$(el).val(hex);
						$(el).ColorPickerHide();
					},
					onBeforeShow: function() {
						$(this).ColorPickerSetColor(this.value);
					}
				}).on('keyup', function() {
					$(this).ColorPickerSetColor(this.value);
				});

				$('#conf-bc-transparent').on('click', function() {
					if ($(this).prop('checked') == true) {
						$('#conf-bc').val('transparent');
						$('#conf-bgi').val('');
					}
				});
			}


			if ($('#conf-bgi').length) {
				if ($("#upload").length) {
					try {
						$("#upload").uploadify('destroy');
					} catch (e) {};
				}

				$("#upload").uploadify({
					height: 30,
					width: 120,
					buttonText: '<div class="row-fluid"><button class="btn btn-block btn-default">选择背景图片</button></div>',
					swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
					uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=1',
					'removeCompleted': false,
					'onUploadSuccess': function(file, data, response) {
						//alert('The file ' + file.name + ' was successfully uploaded with a response of ' + response + ':' + data);
						var res = $.parseJSON(data);
						$('#conf-bgi').val(res.url);
					}
				});
			}

			// 下拉菜单
			if ($('#configModal').find('.dropdown').length) {
				$('#configModal').find('.dropdown').each(function() {
					var oBtn = $(this).find('button');

					$(this).on('click', 'li', function() {
						$(this).addClass('active').siblings().removeClass('active');
						var val = $(this).find('a').text();
						oBtn.html(val + '<span class="caret"></span>');
					});
				});
				$('#configModal').find('.dropdown').each(function() {
					var style = $(this).attr('data-style');
					if (style) {
						var $aLi = $(this).find('li');
						log($aLi.length);
						var targetLi = $aLi.filter(function() {
							var $a = $('a', this);
							var type = $a.attr('data-type');
							log(type);
							return type != style;
						});

						targetLi.length && targetLi.trigger('click');
					};
				});
			}
		},
		buttonFn: {
			fnUpload: fnUpload,
			fnOK: fnOK,
			fnCancel: fnCancel
		}
	};
	callback && $.isFunction(callback) && callback(obj);
};

var addiableReadyFNStrategies = {
	'chunk': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var oH, oBGC, oLink;
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "height") {
					oH = val;
				} else if (attr == "backgroundColor") {
					oBGC = val;
				} else if (attr == "link") {
					oLink = val;
				}
			});

			oLink = oLink ? oLink : '#';
			oH = oH ? oH : 40;
			oBGC = oBGC ? oBGC : '#4198ce';
			oBGC = oBGC.charAt(0) == '#' ? oBGC : '#' + oBGC;
			targetIndex = targetIndex ? targetIndex : 0;

			var oLi = '<li style="background: ' + oBGC + ';height:' + oH + 'px;" operable="upload" data-widget-param="link;height;bc;" data-history-config="link=' + oLink + ';height=' + oH + ';bc=' + oBGC + ';" class="">新增专题图片</li>';

			var targetUl = target.find('ul');
			if (targetUl.length) {
				var $oLi = $(oLi);
				targetUl.eq(targetIndex).append($oLi);
				$oLi.smartMenu(menuData);
			}

			$('#configModal').modal('hide');
		}
	},
	'imgchunk': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var oH, oBGC, oLink;
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "height") {
					oH = val;
				} else if (attr == "backgroundColor") {
					oBGC = val;
				} else if (attr == "link") {
					oLink = val;
				}
			});

			oLink = oLink ? oLink : '#';
			oH = oH ? oH : 40;
			oBGC = oBGC ? oBGC : '#4198ce';
			oBGC = oBGC.charAt(0) == '#' ? oBGC : '#' + oBGC;
			targetIndex = targetIndex ? targetIndex : 0;

			var oLi = '<li style="background: ' + oBGC + ';height:' + oH + 'px;" operable="upload" data-widget-param="link;height;bc;" data-history-config="link=' + oLink + ';height=' + oH + ';bc=' + oBGC + ';" class="">新增专题图片</li>';

			var targetUl = target.find('ul');
			if (targetUl.length) {
				var $oLi = $(oLi);
				targetUl.eq(targetIndex).append($oLi);
				$oLi.smartMenu(menuData);
			}

			$('#configModal').modal('hide');
		}
	},
	'tab-menu': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var oLi = $("<li class='tab-item' operable='text'></li>");
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					oLi.text(val || 'null');
				} else {
					oLi.attr(attr, val || 'null');
				}
			});
			target.append(oLi);
			oLi.smartMenu(menuData);
			var $oP = target.closest('.widget-tab');
			var $tabBody = $oP.find('.tab-body');
			var tabPanel = '<div class="tab-content" operable="tab-panel">' +
				'<ul class="friend-link">' +
				'<li class="friend-link-item"><a href="#" operable="text,href">友情链接一</a></li>' +
				'<li class="friend-link-item"><a href="#" operable="text,href">友情链接二</a></li>' +
				'<li class="friend-link-item"><a href="#" operable="text,href">友情链接三</a></li>' +
				'<li class="friend-link-item"><a href="#" operable="text,href">友情链接四</a></li>' +
				'</ul>' +
				'</div>';
			var $tabPanel = $(tabPanel);
			$tabBody.append($tabPanel);
			$tabPanel.smartMenu(menuData);
			$tabPanel.find('*[operable]').smartMenu(menuData);
			$oP.find('.tab-item').last().trigger('mouseover');
			//extraFn(operType);
			$('#configModal').modal('hide');
		};
	},
	'tab-panel': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var oA = $("<a operable='text,href'></a>");
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					oA.text(val || 'null');
					oA.attr('title', val || 'null');
				} else {
					oA.attr(attr, val || 'null');
				}
			});
			var targetUl = target.find('ul');
			var oLi = $('<li class="friend-link-item"></li>');
			oLi.append(oA).appendTo(targetUl);

			oA.smartMenu(menuData);
			//extraFn(operType);
			$('#configModal').modal('hide');
		};
	},
	'link-panel': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var oA = $("<a operable='text,href'></a>");
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					oA.text(val || 'null');
					oA.attr('title', val || 'null');
				} else {
					oA.attr(attr, val || 'null');
				}
			});
			var oSpan = $("<span class='link-item' operable='link-item'></span>");
			var oLi = $('<li style="background:#ccc;height=30px;" class="link-list-item" operable="chunk" data-widget-param="link;height;bc;bgi;" data-history-config="link=#;height=30;bc=#ccc;bgi=;"></li>');
			oSpan.append(oA).appendTo(oLi);

			var selfElem = self;
			if (selfElem.closest('.link-list').length) {
				selfElem.closest('.link-list').append(oLi);
			} else {
				var lists = target.find('.link-list');
				var tIndex = targetIndex ? targetIndex : 0;
				if (lists.length) {
					//If there are multiple linked list, append to the right one
					lists.eq(tIndex).append(oLi);

					var cl = lists.first().find('div[class*=con]');
					if (cl.length) {
						$clonedIcon = $('<div>').attr({
							'class': cl.attr('class')
						});
						oLi.append($clonedIcon);
					}
				}
			}

			oA.on('click', function(ev) {
				ev.preventDefault();
			});
			oA.smartMenu(menuData);
			oLi.smartMenu(menuData);
			//extraFn(operType);
			$('#configModal').modal('hide');
		};
	},
	'navbar-list': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var href, title;
			var $rows = $modalBody.find(".row-fluid");

			extraConfig = extraFn('navbar-list', elemId, self);
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					title = val || 'undefined';
				} else {
					href = val || 'undefined';
				}
			});
			if (target.hasClass('nav-vert')) {
				// nav-vert
				//1.append new navitem
				var $newLi = $('<li class="navlist-item"><a href="' + href + '" operable="navbar" title="' + title + '">' + title + '</a></li>');
				target.children('ul.navlist').append($newLi);

				//2.append new submenu item
				var $menuContent = $('<div class="menu-content" style="display:none;"></div>');
				var dlHtml = '<dl class="sub-nav-vert" operable="navbar-list">';
				dlHtml += '<dd><a href="#" operable="navbar" title="新增导航">新增导航</a></dd>';
				dlHtml += '<dd><a href="#" operable="navbar" title="新增导航">新增导航</a></dd>';
				dlHtml += '<dd><a href="#" operable="navbar" title="新增导航">新增导航</a></dd>';
				dlHtml += '</dl>';
				$menuContent.html(dlHtml);
				target.append($menuContent);

				var menuContents = target.find('.menu-content');
				$menuContent.find('*[operable]').each(function() {
					$(this).smartMenu(menuData);
				});

				$newLi.find('*[operable]').smartMenu(menuData);

			} else if (target.hasClass('sub-nav-vert')) {

				var $newDD = $('<dd><a href="' + href + '" operable="navbar" title="' + title + '">' + title + '</a></dd>');
				target.append($newDD);
				$newDD.find('*[operable]').smartMenu(menuData);

			} else if (target.hasClass('widget-navbar')) {
				// for site binding
				var aLi = target.find('ul.navbar-list').children('li');
				var last = null,
					lastIndex = -1,
					op = 'text,href';
				if (aLi.length) {
					last = aLi.last().children('a');
					op = last.attr('operable');
					lastIndex = last.attr('data-index');
				}
				var oA = $('<a>').attr({
					'data-index': +lastIndex + 1,
					'operable': op
				});
				var oLi = $('<li>');
				oA.appendTo(oLi);
				target.find('ul.navlist').append(oLi);

				// submit and add to cache
				$('#form1').form('submit', {
					url: ctxUrl + '/modelController/getColumnHtml.do',
					onSubmit: function() {
						return $(this).form('validate');
					},
					success: function(data) {
						var res = $.parseJSON(data)[0];
						for (var n in res) {
							if (res[n] == '') {
								alert('不能为空');
							} else {
								if (n == 'more') {
									oA.attr('href', res['more']);
								} else if (n == 'title') {
									oA.html(unescape(res[n]));
								}
							}
						}
						var dataIndex = oA.attr('data-index');
						widgetConfig = {
							'siteId': $('#site').val(),
							'siteColumnId': $('#siteColumn').val()
						};

						if (elemId in widgetCachedData) {
							elemData = widgetCachedData[elemId];
						} else {
							widgetCachedData[elemId] = {};
							elemData = {
								'type': 'navbar-list',
								'data': {
									'extra': extraConfig
								}
							};
							if (!elemData['data']['widget']) elemData['data']['widget'] = {};
						}

						elemData['data']['widget'][dataIndex] = widgetConfig;
						widgetCachedData[elemId] = elemData;

						var cachedObj = {
							'id': elemId,
							'data': elemData
						};
						oA.closest('.widget-navbar').attr('data-cache', JSON.stringify(cachedObj));
						oA.smartMenu(menuData);
						modalCleanUp();
					}
				});

			} else if (target.hasClass('topmenu')){
				var oA = $('<a>').attr({
					'operable': 'text,href'
				});

				oA.attr({
					'href': href,
					'title': title
				}).text(title);
				var oLi = $('<li>');
				oA.appendTo(oLi);
				target.find('ul').append(oLi);
				oA.smartMenu(menuData);
				modalCleanUp();

			} else {
				var $rows = $modalBody.find(".row-fluid");
				var oA = $("<a operable='navbar'></a>");
				$rows.each(function() {
					var attr = $(this).find(".op_item").attr("op_item"),
						val = $(this).find("input[type='text']").val();
					if (attr == "text") {
						oA.text(val || 'error');
						oA.attr('title', val || 'error');
					} else {
						oA.attr(attr, val || 'error');
					}
				});
				var oLi = $('<li class="navlist-item"></li>');
				oA.appendTo(oLi);

				if (target.hasClass('navlist-item')) {
					// find a place to insert
					var targetUl = target.children('ul.navlist');
					if (!targetUl.length) {
						var newUl = '<ul class="navlist" operable="navbar-list"></ul>';
						target.append(newUl);

						newUl.smartMenu(menuData);
					}
					target.children('ul.navlist').append(oLi);
					// var $tUl = target.children('ul.navlist');
					// var lli = $tUl.children('li');
					// var oW = 100 * lli.length + '%';
					// if (lli.length > 4) {
					// 	oW = '400%';
					// }
					// $tUl.css({
					// 	width : oW
					// });

				} else {
					target.children('ul.navlist').append(oLi);
					oLi.attr({
						'operable': 'navbar-list'
					});
					var percent = '100%';
					if (target.closest('.nav-line').length) {
						percent = '400%';
					}
					var hintDom = '<ul class="navlist" operable="navbar-list" data-widget-param="bc;" data-history-config="bc=#eef;" data-level="1" style="width: ' + percent + '; display: none;">';
					hintDom += '<li class="navlist-item"><a operable="navbar" title="导航项 1" href="#">导航项 1</a></li></ul>';
					var $hintDom = $(hintDom);
					oLi.append($hintDom).smartMenu(menuData);
					$hintDom.find('*[operable]').smartMenu(menuData);;
				}

				oLi.on('mouseover', function() {
					$(this).closest('ul.navlist[data-level=0]').children('li').removeClass('active');
					$(this).closest('ul.navlist[data-level=0]').children('li').each(function() {
						$(this).children('ul.navlist').hide();
					});
					if ($(this).closest('ul.navlist[data-level=0]')) {
						$(this).children('ul.navlist').show();
					}
				});
				oA.smartMenu(menuData);
			}

			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'site-list': function(elemId, self, targetIndex) {
		fnOK = function() {
			var elem = self ? self : $('#' + elemId);
			var first = elem.children('li').first();
			var $cl = first.clone(true);
			elem.append($cl);
			$cl.smartMenu(menuData);

			hideModal();
		};

		fnCancel = modalCleanUp;
	},
	'asidenav': function(elemId, self, targetIndex) {
		fnOK = function() {
			var elem = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var title, link;

			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					title = val || 'undefined';
				} else if ("href") {
					link = val || 'undefined';
				}
			});

			var $a = $('<a href="' + link + '" operable="text,href">' + title + '</a>');
			elem.append($a);
			$a.smartMenu(menuData);

			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'panel-list': function(elemId, self, targetIndex) {
		fnOK = function() {
			var target = self ? self : $('#' + elemId);
			var oModal = $("#configModal");
			var $modalBody = oModal.find('.modal-body');
			var $rows = $modalBody.find(".row-fluid");
			var title, link;

			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "title") {
					title = val || 'undefined';
				} else if ("link") {
					link = val || 'undefined';
				}
			});

			var oTab = $('<li class="tab-list-item" operable="panel-list-item"></li>');
			var oA = $('<a desc="title" href="' + link + '" operable="text,href" title="' + title + '">' + title + '</a>');
			oA.appendTo(oTab);
			oTab.appendTo(target);
			oA.smartMenu(menuData);
			oTab.smartMenu(menuData);

			var oParent = target.closest('.panel-container');
			if (oParent.length) {
				var tabContents = oParent.find('.tab-contents');
				if (tabContents.length) {
					var genId = generatorId(10, null, 'Appendable', 'Generated');
					var fragment = '<div class="contents widget-panel panel" operable="panel" data-widget-param="width;height;bc;bgi;" data-history-config="width=100%;height=auto;bc=#fff;bgi=;" id="' + genId + '" data-widget-id="' + genId + '" style="display: none;">' +
						'<ul desc="contentShow">' +
						'<li>新闻内容一</li>' +
						'<li>新闻内容二</li>' +
						'</ul>' +
						'</div>';

					var $newContent = $(fragment);
					tabContents.append($newContent);
					$newContent.smartMenu(menuData);
				}
			}

			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'footer': function(elemId, self, targetIndex) {
		var target = self ? self : $('#' + elemId);
		var oModal = $("#configModal");
		var $modalBody = oModal.find('.modal-body');
		if (target.hasClass('widget-navbar')) {
			// for site binding
			var aLi = target.find('ul.navbar-list').children('li');
			var last = null,
				lastIndex = -1;
			if (aLi.length) {
				last = aLi.last().children('a');
				lastIndex = last.attr('data-index');
			}
			var oA = $('<a>').attr({
				'data-index': +lastIndex + 1,
				'operable': 'navbar'
			});
			var oLi = $('<li>');
			oA.appendTo(oLi);
			target.find('ul.navlist').append(oLi);

			// submit and add to cache
			$('#form1').form('submit', {
				url: ctxUrl + '/modelController/getColumnHtml.do',
				onSubmit: function() {
					return $(this).form('validate');
				},
				success: function(data) {
					var res = $.parseJSON(data)[0];
					for (var n in res) {
						if (res[n] == '') {
							alert('不能为空');
						} else {
							if (n == 'more') {
								oA.attr('href', res['more']);
							} else if (n == 'title') {
								oA.html(unescape(res[n]));
							}
						}
					}
					var dataIndex = oA.attr('data-index');
					widgetConfig = {
						'siteId': $('#site').val(),
						'siteColumnId': $('#siteColumn').val()
					};

					if (elemId in widgetCachedData) {
						elemData = widgetCachedData[elemId];
					} else {
						widgetCachedData[elemId] = {};
						elemData = {
							'type': 'footer',
							'data': {
								'extra': extraConfig
							}
						};
						if (!elemData['data']['widget']) elemData['data']['widget'] = {};
					}

					elemData['data']['widget'][dataIndex] = widgetConfig;
					widgetCachedData[elemId] = elemData;

					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					oA.closest('.widget-navbar').attr('data-cache', JSON.stringify(cachedObj));
					oA.smartMenu(menuData);
					modalCleanUp();
				}
			});

		} else {
			var $rows = $modalBody.find(".row-fluid");
			var oA = $("<a operable='text,href'></a>");
			$rows.each(function() {
				var attr = $(this).find(".op_item").attr("op_item"),
					val = $(this).find("input[type='text']").val();
				if (attr == "text") {
					oA.text(val || 'error');
					oA.attr('title', val || 'error');
				} else {
					oA.attr(attr, val || 'error');
				}
			});
			var oLi = $('<li class="navlist-item"></li>');
			oA.appendTo(oLi);

			if (target.hasClass('navlist-item')) {
				// find a place to insert
				var targetUl = target.children('ul.navlist');
				if (!targetUl.length) {
					var newUl = '<ul class="navlist" operable="navbar-list"></ul>';
					target.append(newUl);

					newUl.smartMenu(menuData);
				}
				target.children('ul.navlist').append(oLi);

			} else {
				target.children('ul.navlist').append(oLi);
				oLi.attr({
					'operable': 'navbar-list'
				});
				var percent = '100%';
				if (target.closest('.nav-line').length) {
					percent = '500%';
				}
				var hintDom = '<ul class="navlist" operable="navbar-list" data-widget-param="bc;" data-history-config="bc=#eef;" data-level="1" style="width: ' + percent + '; display: none;">';
				hintDom += '<li class="navlist-item"><a operable="navbar" title="导航项 1" href="#">导航项 1</a></li></ul>';
				var $hintDom = $(hintDom);
				oLi.append($hintDom).smartMenu(menuData);
				$hintDom.find('*[operable]').smartMenu(menuData);;
			}

			oLi.on('mouseover', function() {
				$(this).closest('ul.navlist[data-level=0]').children('li').removeClass('active');
				$(this).closest('ul.navlist[data-level=0]').children('li').each(function() {
					$(this).children('ul.navlist').hide();
				});
				if ($(this).closest('ul.navlist[data-level=0]')) {
					$(this).children('ul.navlist').show();
				}
			});
			oA.smartMenu(menuData);
		}

		$('#configModal').modal('hide');
		fnCancel = modalCleanUp;
	}
};

var createReadyFN = function(type, elemId, self, targetIndex, callback) {
	//清空缓存对象
	resetReadyFNVars();

	//构建面板ready事件
	readyFNStrategies[type](elemId, self, targetIndex);

	//组装返回ready事件对象
	var obj = {
		onRenderReady: function() {
			if (setupUpload && $.isFunction(setupUpload)) {
				setupUpload();
			}

			if ($('#conf-bc').length) {
				$('#conf-bc').ColorPicker({
					onSubmit: function(hsb, hex, rgb, el) {
						$(el).val(hex);
						$(el).ColorPickerHide();
					},
					onBeforeShow: function() {
						$(this).ColorPickerSetColor(this.value);
					}
				}).on('keyup', function() {
					$(this).ColorPickerSetColor(this.value);
				});

				$('#conf-bc-transparent').on('click', function() {
					if ($(this).prop('checked') == true) {
						$('#conf-bc').val('transparent');
						$('#conf-bgi').val('');
					}
				});
			}

			if ($('[data-csstype="color"]').length) {
				$('[data-csstype="color"]').ColorPicker({
					onSubmit: function(hsb, hex, rgb, el) {
						$(el).val(hex);
						$(el).ColorPickerHide();
					},
					onBeforeShow: function() {
						$(this).ColorPickerSetColor(this.value);
					}
				}).on('keyup', function() {
					$(this).ColorPickerSetColor(this.value);
				});
			}


			if ($('#conf-bgi').length) {
				if ($("#upload").length) {
					try {
						$("#upload").uploadify('destroy');
					} catch (e) {};
				}

				$("#upload").uploadify({
					height: 30,
					width: 120,
					buttonText: '<div class="row-fluid"><button class="btn btn-block btn-default">选择背景图片</button></div>',
					swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
					uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=1',
					'removeCompleted': false,
					'onUploadSuccess': function(file, data, response) {
						//alert('The file ' + file.name + ' was successfully uploaded with a response of ' + response + ':' + data);
						var res = $.parseJSON(data);
						$('#conf-bgi').val(res.url);
					}
				});
			}

			// 下拉菜单
			if ($('#configModal').find('.dropdown').length) {
				$('#configModal').find('.dropdown').each(function() {
					var oBtn = $(this).find('button');
					var $that = $(this),
						style = $that.attr('data-style');
					$(this).on('click', 'li', function() {
						var val = $(this).find('a').text();
						var type = $(this).find('a').attr('data-type');
						oBtn.html(val + '<span class="caret"></span>');
						$that.attr('data-type', type);
					});

					$(this).find('li').filter(function() {
						var $a = $(this).find('a');
						return $a.attr('data-type') === style;
					}).trigger('click');
				});
			}
			
			$('.multiselect[name="siteArray"]').multiSelect({
				keepOrder : true,
				selectableHeader: "<input type='text' class='search-input' autocomplete='off' placeholder='输入关键字查找'>",
				selectionHeader: "<input type='text' class='search-input' autocomplete='off' placeholder='输入关键字查找'>",
				afterInit: function(ms){
					var that = this,
					    $selectableSearch = that.$selectableUl.prev(),
					    $selectionSearch = that.$selectionUl.prev(),
					    selectableSearchString = '#'+that.$container.attr('id')+' .ms-elem-selectable:not(.ms-selected)',
					    selectionSearchString = '#'+that.$container.attr('id')+' .ms-elem-selection.ms-selected';

					that.qs1 = $selectableSearch.quicksearch(selectableSearchString)
					.on('keydown', function(e){
					  if (e.which === 40){
					    that.$selectableUl.focus();
					    return false;
					  }
					});

					that.qs2 = $selectionSearch.quicksearch(selectionSearchString)
					.on('keydown', function(e){
					  if (e.which == 40){
					    that.$selectionUl.focus();
					    return false;
					  }
					});
				},
				afterSelect : function (value){
					var $select = $('.multiselect[name="siteColumnArray"]');
						$select.find('optgroup[data-siteid="'+ value +'"]')
							   .find('option').removeAttr('disabled');
					
						this.qs1.cache();
	    				this.qs2.cache();
						$select.multiSelect('refresh');

						// fix global vars
						if (!multiSiteIds)multiSiteIds = {};
						multiSiteIds[value] = true;
				},
				afterDeselect : function (value){
					var $select = $('.multiselect[name="siteColumnArray"]');
					var v = [];
						$select.find('optgroup[data-siteid="'+ value +'"]')
							   .find('option').each(function (){
									var vv = $(this).val();
									$(this).attr('disabled', 'disabled');
									v.push(vv);
								});
								
						this.qs1.cache();
    					this.qs2.cache();
						$select.multiSelect('refresh');

						if(value)
							multiSiteIds[value] = false;
				}
			});

			$('.multiselect[name="siteColumnArray"]').multiSelect({
				keepOrder : true,
				selectableOptgroup : true,
				afterSelect : function (value){
					var $select = $('.multiselect[name="siteColumnArray"]');
					var $optgroup = $select.find('option[value="'+ value +'"]').closest('optgroup');
					var siteid = $optgroup.attr('data-siteid');

    				if (!multiSiteColumns) multiSiteColumns = {};
    				if (!multiSiteColumns[siteid]) multiSiteColumns[siteid] = [];
    				
    				multiSiteColumns[siteid].push(value);
				},
				afterDeselect : function (value){
					var $select = $('.multiselect[name="siteColumnArray"]');
					var $optgroup = $select.find('option[value="'+ value +'"]').closest('optgroup');
					var siteid = $optgroup.attr('data-siteid');
					var columns = multiSiteColumns[siteid];
 				    console.log(columns);

 				    if (columns) {
 				    	for (var j = columns.length - 1; j >= 0; j-- ) {
	 				    	if (columns[j] === value) {
	 				    		columns.splice(j, 1);
	 				    		break;
	 				    	}
	 				    }
 				    }
 				    
				}
			});

			$('.multiselect').multiSelect('deselect_all');

		},
		buttonFn: {
			fnUpload: fnUpload,
			fnOK: fnOK,
			fnCancel: fnCancel
		}
	};

	callback && $.isFunction(callback) && callback(obj);
};

// 可编辑类部件在完成配置面板渲染后的事件绑定策略
var readyFNStrategies = {
	'text,href': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var oModal = $('#configModal');
			var $modalBody = oModal.find('.modal-body');
			var aInputs = $modalBody.find('input[type=text]');
			var title = aInputs.eq(0).val();
			elem.html(title);
			aInputs.each(function() {
				if ($(this).attr('data-csstype')) {
					var typeString = $(this).attr('data-csstype'),
						typeVal = $(this).val();
					if (typeString == 'color' && typeVal.indexOf('#') === -1) {
						typeVal = '#' + typeVal;
					}
					elem.css(typeString, typeVal);
				} else {
					elem.attr($(this).attr('data-attrtype'), $(this).val());
				}
			});


			extraFn(null, elemId, self);
			oModal.modal('hide');
		};
	},
	'attrlist': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 10,
				siteLength = $('#siteLength').val() || 16,
				siteTime = $('#siteTime').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				siteLength: siteLength,
				timeFormat: siteTime
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			// var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, {}, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'img-news': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				nrLength = $('#nrLength').val() || 50,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				nrLength: nrLength
			};

			extraConfig = extraFn('img-news', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'nrLength': nrLength
			};
			elemData = {
				'type': 'img-news',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'img-news-v': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 5,
				btLength = $('#btLength').val() || 15,
				nrLength = $('#nrLength').val() || 50,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				btLength: btLength,
				nrLength: nrLength
			};

			extraConfig = extraFn('img-news-v', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'btLength': btLength,
				'nrLength': nrLength
			};
			elemData = {
				'type': 'img-news-v',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'img-news-h': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 5,
				btLength = $('#btLength').val() || 15,
				nrLength = $('#nrLength').val() || 50,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				btLength: btLength,
				nrLength: nrLength
			};

			extraConfig = extraFn('img-news-h', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'btLength': btLength,
				'nrLength': nrLength
			};
			elemData = {
				'type': 'img-news-h',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'img-list': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val(),
				btLength = $('#btLength').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				btLength: btLength
			};

			extraConfig = extraFn('img-list', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'btLength': btLength
			};
			elemData = {
				'type': 'img-list',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'img-scroll-h': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'float': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		setupUpload = function() {
				if ($("#upload").length) {
					try {
						$("#upload").uploadify('destroy');
					} catch (e) {};
				}

				$("#upload").uploadify({
					height: 30,
					width: 120,
					buttonText: '<div class="row-fluid"><button class="btn btn-block btn-default">选择图片</button></div>',
					swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
					uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=1',
					'removeCompleted': false,
					'onUploadSuccess': function(file, data, response) {
						//alert('The file ' + file.name + ' was successfully uploaded with a response of ' + response + ':' + data);
						var res = $.parseJSON(data);
						$('#conf-url').val(res.url);
					}
				});
			},
			fnUpload = function() {
				$("#upload").uploadify("upload", '*');
			},
			fnOK = function() {
				try {
					$("#upload").uploadify('destroy');
				} catch (e) {};

				var oModal = $('#configModal');
				var x = $('#left').val();
				var y = $('#top').val();
				elem.attr({
					'style': 'position:fixed;left:' + x + 'px;top:' + y + "px;"
				});

				elem.find('[desc=targetImage]').attr('src', '/' + $('#conf-url').val());
				oModal.modal('hide');
			};
	},
	'querybar': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var oModal = $('#configModal');
			var action = $('#formAddr').val();
			elem.find('form').attr('action', action);
			oModal.modal('hide');
		};
	},
	'login': function(elemId, self, targetIndex, callback) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var oModal = $('#configModal');
			var action = $('#formAddr').val();
			elem.find('form').attr('action', action);
			oModal.modal('hide');
		};
	},
	'flash': function(elemId, self, targetIndex) {
		setupUpload = function() {
				$("#upload").uploadify({
					height: 30,
					buttonText: '<div class="row-fluid"><button class="btn btn-block btn-default">选择Flash</button></div>',
					swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
					uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=2',
					width: 120,
					'removeCompleted': false,
					'onUploadSuccess': function(file, data, response) {
						//alert('The file ' + file.name + ' was successfully uploaded with a response of ' + response + ':' + data);
						var res = $.parseJSON(data);
						$('#conf-url').val(res.url);
						$('#conf-height').val(res.height);
						$('#conf-width').val(res.width);
					}
				});
			},
			fnUpload = function() {
				$("#upload").uploadify("upload", '*');
			},
			fnOK = function(e) {
				try {
					$("#upload").uploadify('destroy');
				} catch (e) {};
				extraFn('flash', elemId, self);
				$('#configModal').modal('hide');
			};
		fnCancel = modalCleanUp;
	},
	'chunk': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('chunk', elemId, self);
			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'location': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('location', elemId, self);
			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'date': function(elemId, self, targetIndex) {
		fnOK = function(e) {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('date', elemId, self);
			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'weather': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('weather', elemId, self);
			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'countdown': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var endDate = $('#endDate').val(),
				eventName = $('#eventName').val();

			extraConfig = extraFn('countdown', elemId, self);
			widgetConfig = {
				'endDate': endDate,
				'eventName': eventName
			};

			elemData = {
				'type': 'countdown',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};

			// update dom
			elem.find('.event-name').html(eventName ? eventName : 'xxx');
			elem.find('[operable="text"]').smartMenu(menuData);

			// For countdown plugin loading
			writeAttr(elem, 'data-enddate', endDate);
			writeCache(elem, cachedObj);


			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'digest': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				nrLength = $('#nrLength').val() || 50,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: 'digest',
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				nrLength: nrLength
			};

			extraConfig = extraFn('digest', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'nrLength': nrLength
			};
			elemData = {
				'type': 'digest',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				btLength = $('#btLength').val() || 10,
				nrLength = $('#nrLength').val() || 50,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				btLength: btLength,
				nrLength: nrLength
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'btLength': btLength,
				'nrLength': nrLength
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article-title': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName
			};

			//extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId
			};

			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article-author': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName
			};

			//extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId
			};

			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article-share': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName
			};

			//extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId
			};

			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article-date': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteTime = $('#siteTime').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				timeFormat : siteTime
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'timeFormat' : siteTime
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'article-contents': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'imgchunk': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('imgchunk', elemId, self);
			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'upload': function(elemId, self, targetIndex) {
		setupUpload = function() {
				if ($("#upload").length) {
					try {
						$("#upload").uploadify('destroy');
					} catch (e) {};
				}

				$("#upload").uploadify({
					height: 30,
					width: 120,
					buttonText: '<div class="row-fluid"><button class="btn btn-block btn-default">选择图片</button></div>',
					swf: ctxUrl + '/cmskj/js/uploadify/uploadify.swf',
					uploader: ctxUrl + '/attachmentController/uploadReturnUrl.do?type=1',
					'removeCompleted': false,
					'onUploadSuccess': function(file, data, response) {
						//alert('The file ' + file.name + ' was successfully uploaded with a response of ' + response + ':' + data);
						var res = $.parseJSON(data);
						$('#conf-url').val(res.url);
						$('#conf-height').val(res.height);
						$('#conf-width').val(res.width);
					}
				});
			},
			fnOK = function() {
				try {
					$("#upload").uploadify('destroy');
				} catch (e) {};

				extraFn('upload', elemId, self);
				$('#configModal').modal('hide');
			};

		fnCancel = modalCleanUp;
	},
	'panel': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val(),
				siteLength = $('#siteLength').val() || 15,
				siteTime = $('#siteTime').val(),
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName'),
				hookFlag = elem.attr('data-hooks');

			if (hookFlag && hookFlag == 'list' || hookFlag == 'cont'){
				siteSimpleName = '${nr.site.siteSimpleName}';
				columnSimpleName = '${nr.siteColumn.columnSimpleName}';
			}

			//log(siteSimpleName, siteColumnSimpleName);
			// 用ftlTransformer取得相应的FreeMarker标签，写入dom和缓存中
			var listStyleType = $('#dropdownListStyle').closest('.dropdown').attr('data-type');
			var underlineType = $('#dropdownUnderline').closest('.dropdown').attr('data-type');
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				titleIconType: 'flag',
				siteCount: siteCount,
				siteLength: siteLength,
				dateType: 'date-normal',
				listStyleType: listStyleType,
				underlineType: underlineType,
				timeFormat: siteTime
			};

			extraConfig = extraFn(ftlType, elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength,
				'siteTime': siteTime,
				'listStyleType': listStyleType,
				'underlineType': underlineType
			};
			elemData = {
				'type': ftlType,
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);

			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'link-panel': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var target = elem;
			extraConfig = extraFn('link-panel', elemId, self);
			var dhc = "";
			dhc += 'width=' + extraConfig['width'] + ';';
			dhc += 'height=' + extraConfig['height'] + ';';
			dhc += 'bc=' + extraConfig['bgcolor'] + ';';
			dhc += 'bgi=' + extraConfig['bgimage'] + ';';

			target.attr('data-history-config', dhc);
			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'navbar-list': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};
			extraFn('navbar-list', elemId, self);
			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'asidenav': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('asidenav', elemId, self);
			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'footer': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('footer', elemId, self);
			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'scroll-h': function(elemId, self, targetIndex) {
		fnOK = function() {
			try {
				$("#upload").uploadify('destroy');
			} catch (e) {};

			extraFn('scroll-h', elemId, self);
			$('#configModal').modal('hide');
		};

		fnCancel = modalCleanUp;
	},
	'navbar': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			$('#form1').form('submit', {
				url: ctxUrl + '/modelController/getColumnHtml.do',
				onSubmit: function() {
					return $(this).form('validate');
				},
				success: function(data) {
					var res = $.parseJSON(data)[0];
					var target = elem;
					for (var n in res) {
						if (res[n] == '') {
							alert('不能为空');
						} else {
							if (n == 'more') {
								$(target).attr('href', res['more']);
							} else if (n == 'title') {
								$(target).html(unescape(res[n]));
							}
						}
					}
					var dataIndex = target.attr('data-index');
					widgetConfig = {
						'siteId': $('#site').val(),
						'siteColumnId': $('#siteColumn').val()
					};

					if (widgetCachedData[elemId]) {
						elemData = widgetCachedData[elemId];
					} else {
						elemData = {
							'type': 'navbar',
							'data': {
								'extra': extraConfig
							}
						};
						if (!elemData['data']['widget']) elemData['data']['widget'] = {};
					}

					elemData['data']['widget'][dataIndex] = widgetConfig;
					widgetCachedData[elemId] = elemData;
					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					target.closest('.widget-navbar').attr('data-cache', JSON.stringify(cachedObj));

					$("[desc=content]", target).attr('style', "");
					modalCleanUp();
				}
			});

		};
	},
	'easyslides': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 15,
				siteLength = $('#siteLength').val() || 15,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				siteLength: siteLength
			};

			extraConfig = extraFn('panel', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength
			};
			elemData = {
				'type': 'easyslides',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'slidenormal': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 15,
				siteLength = $('#siteLength').val() || 15,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				siteLength: siteLength
			};

			extraConfig = extraFn('slidenormal', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength
			};
			elemData = {
				'type': 'slidenormal',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'slidetop': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 15,
				siteLength = $('#siteLength').val() || 15,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				siteLength: siteLength
			};

			extraConfig = extraFn('slidetop', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength
			};
			elemData = {
				'type': 'slidetop',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'bot_ppt': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var siteId = $('#site').val(),
				siteColumnId = $('#siteColumn').val(),
				siteCount = $('#siteCount').val() || 15,
				siteLength = $('#siteLength').val() || 15,
				siteName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteName'),
				columnName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnName'),
				siteSimpleName = ftlHandler.fetchKey('site', 'siteId', siteId, 'siteSimpleName'),
				columnSimpleName = ftlHandler.fetchKey('siteColumn', 'columnId', siteColumnId, 'columnSimpleName');

			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				siteName: siteName,
				siteSimpleName: siteSimpleName,
				columnName: columnName,
				columnSimpleName: columnSimpleName,
				siteCount: siteCount,
				siteLength: siteLength
			};

			extraConfig = extraFn('bot_ppt', elemId, self);
			widgetConfig = {
				'siteId': siteId,
				'siteColumnId': siteColumnId,
				'siteCount': siteCount,
				'siteLength': siteLength
			};
			elemData = {
				'type': 'bot_ppt',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;

			var cachedObj = {
				'id': elemId,
				'data': elemData
			};


			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			writeCache(elem, cachedObj);
		};

		fnCancel = modalCleanUp;
	},
	'powerpoint': function(elemId, self, targetIndex) {
		var elem = self || $('#' + elemId);
		fnOK = function() {
			extraConfig = extraFn('powerpoint', elemId, self);
			$('#form1').form('submit', {
				url: ctxUrl + '/modelController/getColumnImgHtml.do',
				onSubmit: function() {
					return $(this).form('validate');
				},
				success: function(data) {
					var res = $.parseJSON(data)[0];
					var target = elem;
					for (var n in res) {
						if (res[n] == '') {
							alert('不能为空');
						} else {
							if (n == 'more') {
								$('[desc="more"]', target).attr('href', res['more']);
							} else {
								$('[desc="' + n + '"]', target).html(Utils.HTMLUnescape(res[n]));
								if (n == 'content') {
									target.attr('desc_ext', Utils.HTMLUnescape(res[n]));
								}
							}
						}
					}
					$("[desc=content]", target).attr('style', "");

					widgetConfig = {
						'siteId': $('#site').val(),
						'siteColumnId': $('#siteColumn').val(),
						'siteCount': $('#siteCount').val() || 20,
						'siteLength': $('#siteLength').val() || 15
					};
					elemData = {
						'type': 'powerpoint',
						'data': {
							'widget': widgetConfig,
							'extra': extraConfig
						}
					};
					widgetCachedData[elemId] = elemData;
					// fix the pager li
					var oPager = elem.find('ul.pagenation');
					var multiFlag = oPager.length == 0;
					var pageBtnClass = 'page-btn';
					if (multiFlag) {
						oPager = elem.find('ul.btn-list');
					}
					var aLi = oPager.children('li');
					var tot = parseInt(widgetConfig['siteCount']);
					if (tot > aLi.length) {
						var dis = tot - aLi.length;
						for (var i = 1; i <= dis; i++) {
							var idx = aLi.length + i;
							var pagerLi = $('<li>').attr({
								'class': pageBtnClass
							}).html(idx);
							oPager.append(pagerLi);
						}
					} else if (tot < aLi.length) {
						while (oPager.children('li').length && tot < oPager.children('li').length) {
							oPager.children('li').last().remove();
						}
					}

					if (elem.hasClass('multi-ppt')) {
						var aaLi = oPager.children('li');
						aaLi.text('').removeClass('active');
						aaLi.first().addClass('active');
					}
					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					target.attr('data-cache', JSON.stringify(cachedObj));
					modalCleanUp();
				}
			});
		};
	},
	'text': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var oModal = $('#configModal');
			var $modalBody = oModal.find('.modal-body');
			var aInputs = $modalBody.find('input[type=text]');
			var title = aInputs.eq(0).val();
			elem.html(title);
			aInputs.each(function() {
				if ($(this).attr('data-csstype')) {
					elem.css($(this).attr('data-csstype'), $(this).val());
				} else {
					elem.attr($(this).attr('data-attrtype'), $(this).val());
				}
			});
			oModal.modal('hide');
		};
		fnCancel = modalCleanUp;
	},
	'vote': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			var id = $('#voteSelect').find('option:selected').val(),
				id = $.trim(id),
				title = $('#voteSelect').find('option:selected').html();

			widgetConfig = {
				'voteId': id
			};


			$.ajax({
				url: '../suffrageController/getOptionList.do?id=' + id,
				type: "POST",
				cache: false,
				async: true,
				dataType: 'JSON',
				success: function(res) {
					//Write in cache
					var template = buildVoteTemplate(title, res);
					elem.find('.vote-body').html(template);
					extraConfig = extraFn('vote', elemId, self);
					elemData = {
						type: 'vote',
						data: {
							'widget': widgetConfig,
							'extra': extraConfig
						}
					};

					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					elem.attr('data-cache', JSON.stringify(cachedObj));
					widgetCachedData[elemId] = elemData;
					modalCleanUp();
				}
			});
		};
	},
	'site-list': function(elemId, self, targetIndex) {
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			extraConfig = extraFn('site-list', elemId, self);

			if (!$('#siteColumn').val()) {
				//构建子栏目项
				$.ajax({
					url: ctxUrl + '/siteColumnController/getSiteColumn.do',
					cache: false,
					async: true,
					type: 'POST',
					data: {
						'siteId': $('#site').val()
					},
					success: function(d) {
						var res = $.parseJSON(d);

						buildSubsiteList(elem, res, $('#subSiteCount').val() || 1 << 5, function() {
							var optVal = $('#site').find('option[value=' + $('#site').val() + ']').text();

							$('[desc=title]', elem.closest('.widget-chunk')).html(optVal);

							widgetConfig = {
								'siteId': $('#site').val(),
								'siteColumnId': $('#siteColumn').val(),
								'subSiteCount': $('#subSiteCount').val()
							};
							elemData = {
								'type': 'site-list-item',
								'data': {
									'widget': widgetConfig,
									'extra': extraConfig
								}
							};
							widgetCachedData[elemId] = elemData;
							var cachedObj = {
								'id': elemId,
								'data': elemData
							};
							elem.attr('data-cache', JSON.stringify(cachedObj));

							$('#configModal').modal('hide');
						});
					}
				});
				return;
			}

			$('#form1').form('submit', {
				url: ctxUrl + '/modelController/getColumnHtml.do',
				onSubmit: function() {
					return $(this).form('validate');
				},
				success: function(data) {
					var res = $.parseJSON(unescape(data))[0];
					var target = elem;
					for (var n in res) {
						if (res[n] == '') {
							alert('不能为空');
						} else {
							if (n == 'more') {
								if (target.closest('.widget-chunk').length) {
									$('[desc=more]', target.closest('.widget-chunk')).attr('href', res['more']);
								} else {
									target.attr('href', res['more']);
								}
							} else if (n == 'title') {
								if (target.closest('.widget-chunk').length) {
									$('[desc=title]', target.closest('.widget-chunk')).html(unescape(res[n]));
								} else {
									target.html(unescape(res[n]));
								}

							}
						}
					}
					var ssLength = $('#subSiteCount').val();
					widgetConfig = {
						'siteId': $('#site').val(),
						'siteColumnId': $('#siteColumn').val(),
						'subSiteCount': ssLength
					};
					elemData = {
						'type': 'site-list-item',
						'data': {
							'widget': widgetConfig,
							'extra': extraConfig
						}
					};
					widgetCachedData[elemId] = elemData;
					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					target.attr('data-cache', JSON.stringify(cachedObj));
					$('#configModal').modal('hide');

					// async building
					// Get Subsites and build it

					var ssUrl = ctxUrl + '/siteColumnController/getChildJson.do?fatherId=' + $('#siteColumn').val();
					$.ajax({
						url: ssUrl,
						type: 'get',
						dataType: 'json',
						success: function(sub) {
							buildSubsiteList(target, sub, ssLength);
						}
					});

				}
			});
		};

		fnCancel = modalCleanUp;
	},
	'news-group': function(elemId, self, targetIndex) {
		//ctxUrl + '/modelController/getMoreMsgHtml.do?t=' + Math.random(),
		var elem = self ? self : $('#' + elemId);
		fnOK = function() {
			extraConfig = extraFn('news-group', elemId, self);
			$('#form1').form('submit', {
				url: ctxUrl + '/modelController/getMoreMsgHtml.do?t=' + Math.random(),
				onSubmit: function() {
					return $(this).form('validate');
				},
				success: function(data) {
					var res = $.parseJSON(data)[0];
					var target = elem;
					for (var n in res) {
						if (res[n] == '') {
							alert('不能为空');
						} else {
							if (n == 'more') {
								$('[desc="more"]', target).attr('href', res['more']);
							} else {
								$('[desc="' + n + '"]', target).html(Utils.HTMLUnescape(res[n]));
								if (n == 'content') {
									target.attr('desc_ext', Utils.HTMLUnescape(res[n]));
								}
							}
						}
					}

					widgetConfig = {
						'siteId': $('#site').val(),
						'siteColumnId': $('#siteColumn').val(),
						'siteCount': $('#siteCount').val(),
						'btLength': $('#btLength').val(),
						'nrLength': $('#nrLength').val()
					};
					elemData = {
						'type': 'news-group',
						'data': {
							'widget': widgetConfig,
							'extra': extraConfig
						}
					};
					widgetCachedData[elemId] = elemData;
					var cachedObj = {
						'id': elemId,
						'data': elemData
					};
					target.attr('data-cache', JSON.stringify(cachedObj));

					// fix target content length
					// var oUl = target.children('ul');
					// var firstChild = oUl.children().first().clone(true);
					// // fix firstChild contents
					// oUl.empty();
					// for (var i=0,l=$('#siteCount').val(); i<l ;i++){
					// 	var $cl = firstChild.clone(true);
					// 	oUl.append($cl);
					// }
					$('#configModal').modal('hide');
				}
			});
		};
		fnCancel = modalCleanUp;
	},
	'nav-auto' : function (elemId, self, targetIndex){
		var elem = self ? self : $('#' + elemId);
		fnOK = function (){
			var ftlType = ftlHandler.fetchType(elem);
			var ftlJson = {
				type: ftlType,
				sites: multiSiteIds,
				siteColumns: multiSiteColumns
			};
			
			widgetConfig = {
				'sites': multiSiteIds,
				'siteColumns': multiSiteColumns
			};
			extraConfig = {
				bgColor : '#2b2b2b',
				color : '#fff',
				target : 'blank',
				hovered : {
					bgColor : '#aaa',
					color : '#eee'
				},
				subNav : {
					bgColor : '#ccc',
					color : '#baff00',
					hovered : {
						bgColor : '#aaa',
						color : "#f40"
					}
				}
			};

			elemData = {
				'type': 'nav-auto',
				'data': {
					'widget': widgetConfig,
					'extra': extraConfig
				}
			};
			widgetCachedData[elemId] = elemData;
			writeCache(elem, elemData);

			multiSiteIds = {};
			multiSiteColumns = {};

			var ftlDom = ftlTransformer(ftlJson);
			var contentDom = contentTransformer(ftlJson);
			updateDomByTemplate(elem, contentDom, ftlDom, ftlJson);

			$('#configModal').modal('hide');
		};
		fnCancel = modalCleanUp;
	}
};


function constructNavStructure (siteNames, columnNames) {
	var ret = {};

	for (var siteName in siteNames){
		if (siteNames[siteName] == true) {
			$.each(defaultData['sites'], function (j, site){
				if (site['siteName'] === siteName) {
					if (!ret['sites']) {
						ret['sites'] = [];
					}
					ret['sites'].push(site);
				}
			});
		}
	}

	for (var i = 0, sites = ret['sites'], sl = (sites && sites.length) || 0; i < sl; i++) {
		var cols = defaultData['siteColumns'][sites[i]['siteId']];

		for (var j = 0, l = cols.length; j < l; j++) {
			
			for (var columnName in columnNames) {
				if (columnName && columnNames[columnName] == true) {
					console.log(columnName + ':' + cols[j]['siteColumnName']);
					if (columnName === cols[j]['siteColumnName']) {
						if (!ret[siteid]['columns']){
							ret[siteid]['columns'] = [];
						}
						ret[siteid]['columns'].push(cols[j]);
					}
				}
			}
	
		}
	}

	return ret;
}

// 右键设置后，针对不同 dom 的更新策略
// 
// //默认的dom更新策略
var
	defaultPanelDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').each(function (){
			$(this).replaceWith(content);
		});
		$obj.find('*[operable]').smartMenu(menuData);

		var moreUrl = getMoreUrl(ftl);
		var columnName = getColumnName(ftl);
		$obj.find('[desc="title"]').html(columnName);
		$obj.find('[desc="more"]').attr('href', moreUrl);
		if ($obj.closest('.widget-chunk').length) {
			var $oP = $obj.closest('.widget-chunk');
			var index = $obj.index();
			$oP.find('[desc="title"]').eq(index).html(columnName);
			$oP.find('[desc="more"]').eq(index).attr('href', moreUrl);
		}
		$('#configModal').modal('hide');
	},
	defaultAttrlistDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultPanelPicDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', template);
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		console.log(content);
		var moreUrl = getMoreUrl(ftl);
		var columnName = getColumnName(ftl);
		$obj.find('[desc="title"]').html(columnName);
		$obj.find('[desc="more"]').attr('href', moreUrl);
		if ($obj.closest('.widget-chunk').length) {
			var $oP = $obj.closest('.widget-chunk');
			var index = $obj.index();
			$oP.find('[desc="title"]').eq(index).html(columnName);
			$oP.find('[desc="more"]').eq(index).attr('href', moreUrl);
		}
		$('#configModal').modal('hide');
	},
	defaultPanelDownloadDomUpdateFn = function($obj, content, template, ftl) {

	},
	defaultPPTDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultPPTNormalDomUpdateFn = function($obj, content, template, ftl) {

		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		var pager = $obj.find('.slider_page');
		pager.empty();
		if (+ftl['siteCount']) {
			var fragment = '';
			for (var i = 0, l = ftl['siteCount']; i < l; i++) {
				if (!i) {
					fragment += '<li class="current">' + (i + 1) + '</li>';
				} else {
					fragment += '<li>' + (i + 1) + '</li>';
				}
			}
			pager.html(fragment);
		}
		$('#configModal').modal('hide');
	},
	defaultPPTTopDomUpdateFn = function($obj, content, template, ftl) {

		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		var pager = $obj.find('.slider_page');
		pager.empty();
		if (+ftl['siteCount']) {
			var fragment = '';
			for (var i = 0, l = ftl['siteCount']; i < l; i++) {
				if (!i) {
					fragment += '<li class="current">' + (i + 1) + '</li>';
				} else {
					fragment += '<li>' + (i + 1) + '</li>';
				}
			}
			pager.html(fragment);

		}
		$('#configModal').modal('hide');
	},
	defaultPPTBotDomUpdateFn = function($obj, content, template, ftl) {

		$obj.attr('desc_ext', Utils.HTMLUnescape(template['html']));
		$obj.attr('sm_desc_ext', Utils.HTMLUnescape(template['smHtml']));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);
		var ctrl = $obj.find('#tFocus-btn');
		var ctrlUl = ctrl.find('ul');
		ctrlUl.empty();
		if (+ftl['siteCount']) {
			var fragment = '';
			for (var i = 0, l = ftl['siteCount']; i < l; i++) {
				fragment += '<li style="width:87px;height:57px;background:#4198ce;"><img src=""></li>';
			}
			ctrlUl.html(fragment);
		}
		$('#configModal').modal('hide');
	},
	defaultImgNewsDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', template);
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);


		var moreUrl = getMoreUrl(ftl);
		var columnName = getColumnName(ftl);
		$obj.find('[desc="title"]').html(columnName);
		$obj.find('[desc="more"]').attr('href', moreUrl);
		//$obj.find('[desc="image"]').attr('src', '/../../${nr.msgAll.headImg}');
		if ($obj.closest('.widget-chunk').length) {
			var $oP = $obj.closest('.widget-chunk');
			var index = $obj.index() || 0;
			$oP.find('[desc="title"]').eq(index).html(columnName);
			$oP.find('[desc="more"]').eq(index).attr('href', moreUrl);
			//$oP.find('[desc="image"]').eq(index).attr('src', '/../../${nr.msgAll.headImg}');
		}
		$('#configModal').modal('hide');
	},
	defaultImgListDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		var moreUrl = getMoreUrl(ftl);
		var columnName = getColumnName(ftl);

		if ($obj.closest('.widget-chunk').length) {
			var $oP = $obj.closest('.widget-chunk');
			var index = $obj.index();
			$oP.find('[desc="title"]').eq(index).html(columnName);
			$oP.find('[desc="more"]').eq(index).attr('href', moreUrl);
		}
		$('#configModal').modal('hide');
	},

	defaultHVImgNewsDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultDigestDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultArticleDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);
		

		$('#configModal').modal('hide');
	},
	defaultImgScrollHDomUpdateFn = function($obj, content, template, ftl) {
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultContTplDomUpdateFn = function ($obj, content, template, ftl){
		$obj.attr('desc_ext', Utils.HTMLUnescape(template));
		$obj.find('[desc="contentShow"]').replaceWith(content);
		$obj.find('*[operable]').smartMenu(menuData);

		$('#configModal').modal('hide');
	},
	defaultNavAutoDomUpdateFn = function ($obj, content, template, ftl){
		$obj.html(content);

		$('#configModal').modal('hide');
	},
	updateDomStrategies = {
		'undefined': defaultPanelDomUpdateFn,
		'panel': defaultPanelDomUpdateFn,
		'panel-type0': defaultPanelDomUpdateFn,
		'panel-type1': defaultPanelDomUpdateFn,
		'panel-type2': defaultPanelDomUpdateFn,
		'panel-type3': defaultPanelDomUpdateFn,
		'panel-type4': defaultPanelDomUpdateFn,
		'panel-type5': defaultPanelDomUpdateFn,
		'panel-type6': defaultPanelDomUpdateFn,
		'panel-unsorted': defaultPanelDomUpdateFn,
		'panel-pic-v': defaultPanelPicDomUpdateFn,
		'panel-pic': defaultPanelPicDomUpdateFn,
		'panel-download': defaultPanelDownloadDomUpdateFn,
		'img-list': defaultImgListDomUpdateFn,
		'img-news': defaultImgNewsDomUpdateFn,
		'img-news-h': defaultHVImgNewsDomUpdateFn,
		'img-news-v': defaultHVImgNewsDomUpdateFn,
		'easyslides': defaultPPTDomUpdateFn,
		'slidenormal': defaultPPTNormalDomUpdateFn,
		'slidetop': defaultPPTTopDomUpdateFn,
		'bot_ppt': defaultPPTBotDomUpdateFn,
		'digest': defaultDigestDomUpdateFn,
		'article': defaultArticleDomUpdateFn,
		'article-title': defaultArticleDomUpdateFn,
		'article-author': defaultArticleDomUpdateFn,
		'article-share': defaultArticleDomUpdateFn,
		'article-date': defaultArticleDomUpdateFn,
		'article-contents': defaultArticleDomUpdateFn,
		'scroll-v': defaultPanelDomUpdateFn,
		'img-scroll-h': defaultImgScrollHDomUpdateFn,
		'attrlist': defaultAttrlistDomUpdateFn,
		'cont-tpl': defaultContTplDomUpdateFn,
		'cont-tpl1': defaultContTplDomUpdateFn,
		'cont-tpl2': defaultContTplDomUpdateFn,
		'cont-tpl3': defaultContTplDomUpdateFn,
		'nav-auto': defaultNavAutoDomUpdateFn
	};

/* AOP */
Function.prototype.after = function(afterfn) {
	var __self = this;
	return function() {
		var ret = __self.apply(this, arguments);
		afterfn.apply(this, arguments);
		return ret;
	};
};

function getColumnName(ftl) {
	return ftl['columnName'];
}

function getMoreUrl(ftl) {
	return window.absUrl + '/' + ftl['siteSimpleName'] + '/' + ftl['columnSimpleName'] + '/' + ftl['columnSimpleName'] + '.html'
}

function updateDomByTemplate($obj, content, template, ftl) {
	updateDomStrategies[ftl['type']]($obj, content, template, ftl);
}

/**
 * [buildSubsiteList 在绑定了站点和栏目之后，构建子栏目列表]
 * @param  {[$Element]} target   [当前操作的目标]
 * @param  {[JSON]} json     [返回的子站json]
 * @param  {[Number]} ssLength [构建的长度]
 * @return {[void]}          [description]
 */
function buildSubsiteList(target, json, ssLength, callback) {
	ssLength = ssLength || json.length;
	if (json.length == 0) {
		alert('此站点/栏目下无子栏目，请重新选择');
		return;
	}
	var $clone = target.children('li').first().clone();
	target.empty();
	for (var i = 0, d; i < ssLength && (d = json[i++]);) {
		var name = d['siteName'] || d['columnName'];
		var href = d['siteLink'] || d['externalUrl'];
		var $cc = $('<a href="' + href + '">' + name + '</a>');
		var $newClone = $clone.html($cc).clone();
		target.append($newClone);
	}
	// var subsiteList = '<dl>';
	// ssLength = ssLength || 0;
	// for (var i=0, d; i < ssLength && (d=json[i++]);) {
	// 	subsiteList += '<dd>';
	// 	subsiteList += '<a href="#' + d['externalUrl'] + '">'+ d['columnName'] +'</a>';
	// 	subsiteList += '</dd>';
	// }

	// subsiteList += '</dl>';

	// var oP = $(target).parent();
	// var $clone = $(target).clone(true);
	// oP.empty().append($clone).append(subsiteList);
	// $clone.smartMenu(menuData);
	callback && $.isFunction(callback) && callback();
};

/**
 * [proxyCreateReadyFN ready事件的代理，委托并构建配置面板的ready事件]
 * @param  {[String]}   type        [部件类型]
 * @param  {[String]}   elemId      [部件id]
 * @param  {[$Element]}   self        [当前操作对象]
 * @param  {[String]}   todo        [操作类型]
 * @param  {[Number]}   targetIndex [多部件情况下的定位索引]
 * @param  {Function} callback    [回调函数]
 * @return {[void]}               [description]
 */
var proxyCreateReadyFN = function(type, elemId, self, todo, targetIndex, callback) {
	if (todo && todo === 'append') {
		createAddiableReadyFN(type, elemId, self, targetIndex, function(ready) {
			callback && $.isFunction(callback) && callback(ready);
		});
	} else {
		createReadyFN(type, elemId, self, targetIndex, function(ready) {
			callback && $.isFunction(callback) && callback(ready);
		});
	}
};

/**
 * [constructConfigPanelTemplate description]
 * @param  {[String]} type   [Operable type that indicates a specific widget]
 * @param  {[String]} elemId [Source Element that need to be configured,
 *                          will pass the parameters to the panel and then pass it back when legally finished]
 * @param  {[$Element]} self    [If not specify an element id, pass the self reference inside]
 * @param  {[String]} todo    [Indicates which command to do]
 * @param  {[Number]} targetIndex    [For multiple sub widgets, it's optional]
 * @param  {[Function]} callback    [For multiple sub widgets, it's optional]
 * @return {[void]}        [description]
 */
function constructConfigPanelTemplate(type, elemId, self, todo, targetIndex, callback) {
	proxyCreateWidgetPanel(type, elemId, self, todo, targetIndex, function(fragment) {
		(function(fragment) {
			var f, r;
			f = fragment;
			proxyCreateReadyFN(type, elemId, self, todo, targetIndex, function(readyFN) {
				r = readyFN;
				var obj = {
					'body': f,
					'footer': '<button class="btn btn-primary">确定</button><button class="btn btn-default" data-dismiss="modal">取消</button>',
					'onRenderReady': r['onRenderReady'],
					'buttonFn': r['buttonFn']
				};
				callback && $.isFunction(callback) && callback(obj);
			});
		})(fragment);
	});
}

/**
 * [initSourceCodeEditor description]
 * @return {[type]}
 */
function initSourceCodeEditor(html) {
	var oPanel = $('#sourceCodePanel');
	var w = ($(window).width() - oPanel.width()) / 2;
	var h = ($(window).height() - oPanel.height()) / 2;
	$('#sourceCodeWrapper').html(html);

	w = w > 10 ? w : 10;
	h = h > 10 ? h : 10;
	oPanel.css({
		display: "block",
		left: w,
		top: h
	}).appendTo($('.mask')).show();
	$(window).scrollTop(0);
}

/**
 * [initSourceCodePanel description]
 * @return {[type]}
 */
function initSourceCodePanel(htmlCode, callback) {
	var oModal = $('#configModal');
	var fragment = "<div class='container'>";
	fragment += '<textarea class="editor" name="editor"></textarea>';
	fragment += '</div>';
	oModal.find('.modal-body').html($(fragment).find('textarea').text(htmlCode));
	setTimeout(function (){
		oModal.modal('show');
	}, 1000);

	oModal.find('.modal-footer').find('.btn-primary').on('click', function() {
		oModal.modal('hide');
		if (callback && $.isFunction(callback)) {
			var html = CKEDITOR.instances.editor.getData();
			callback(html);
		}
	});

	oModal.on('shown', function (){
		CKEDITOR.replace('editor');
	});
}

/**
 * [buildVoteTemplate This function will return a well formatted vote for later usage]
 * @return {[String]}
 */
function buildVoteTemplate(title, questions) {
	var l = 0,
		genId = generatorId(4, 16, '', 'gen'),
		fragment = '<form id="voteForm_' + genId + '" class="vote-form" method="POST" uriPrefix="' + absUrl + '" >';
	if (l = questions.length) {
		fragment += '<div class="row"><div class="div_topic"><h3>' + title + '</h3></div></div>';
		fragment += '<input type="hidden" name="cc">';
		for (var i = l - 1, seq = 1; i >= 0; i--, seq++) {
			var currentQ = questions[i];

			fragment += '<div class="div_topic">';

			// Question contents
			var optType = parseInt(currentQ['QUESTION_TYPE']), //问卷类型
				id = currentQ['ID'], //问卷ID
				opts = currentQ['interactiveOption'], //问卷选项
				//seq     = currentQ['SEQUENCE'],//序列号
				ques = currentQ['QUESTION'], //问题
				intID = currentQ['INTERACTIVE_ID'], //interative_id   选项id
				ol = 0;

			fragment += '<input type="hidden" name="interactiveId" value="' + intID + '" />';
			fragment += '<input type="hidden" name="aa" value="' + id + '">';
			if (optType == 1) {
				//Single option
				if (ol = opts.length) {
					//title
					fragment += '<h4><input type="hidden" name="' + id + '" value="' + intID + '">' + (seq + '、') + ques + '</h4>';
					for (; --ol >= 0;) {
						var opt = opts[ol];
						fragment += '<p><input type="radio" name="' + id + '" value="' + opt["id"] + '">';
						fragment += opt["optionValue"];
						fragment += '</p>';
					}
				}
			} else if (optType == 2) {
				//Multiple option
				if (ol = opts.length) {
					//title
					fragment += '<h4><input type="hidden" name="' + id + '" value="' + intID + '">' + (seq + '、') + ques + '</h4>';

					for (; --ol >= 0;) {
						var opt = opts[ol];
						fragment += '<p><input type="checkbox" name=' + id + ' value="' + opt["id"] + '">';
						fragment += opt["optionValue"];
						fragment += '</p>';
					}
				}
			} else if (optType == 3) {
				// Mix type
				if (ol = opts.length) {
					//title
					fragment += '<h4><input type="hidden" name="' + id + '" value="' + intID + '">' + (seq + '、') + ques + '</h4>';

					for (; --ol >= 0;) {
						var opt = opts[ol];
						fragment += '<p><input type="checkbox" name=' + id + ' value="' + opt["id"] + '">';
						fragment += opt["optionValue"];
						fragment += '</p>';
					}
				}
			} else if (optType == 4) {

				//title
				fragment += '<h4>' + (seq + '、') + ques + '</h4>';

				fragment += '<textarea rows="6" cols="60" style="height:100px;" name="' + id + '1"></textarea>';

			} else {
				// Undefined
			}

			fragment += '</div>';
		}

		fragment += '<div class="div_topic">';
		fragment += '<button type="submit" class="btn btn-primary">确定</button>';
		fragment += '</div>';
	} else {
		alert('无问卷数据');
	}
	fragment += '</form>';
	return fragment;
}