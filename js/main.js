/**
 * @fileoverview 腾讯地图测距工具类，对外开放。
 * 用户可以创建新的测距实例，实现距离的测量。
 * 用户可以根据喜好自定义测距的相关样式。
 * 基于腾讯地图API 2.0
 *
 * @author QQ Map Api Group
 * @version 1.0
 * @type {QQMapPlugin|*|{}}
 */

/**
 * @namespace QQMapPlugin
 */
var QQMapPlugin = window.QQMapPlugin = QQMapPlugin || {};

(function () {
    /**
     * MeasureDistance类的构造函数
     * 测距类，实现测距功能的入口。
     * 用户实例化该类后，即可调用该类提供的start方法开启测距状态。
     * @class
     * @name QQMapPlugin.MeasureDistance
     * @memberof QQMapPlugin
     * @param {Map} map qq.maps.Map类的实例
     */
    function MeasureDistance(map) {
        /** @lends MeasureDistance.prototype */
        /**
         * @param {Map} map
         * map对象
         * @public
         */
        this.map = map;

        /**
         * 是否开启了测距状态
         * @type {boolean}
         * @private
         */
        this._isStart = false;
    }

    /**
     * 开启地图的测距状态。
     * 使用MVC架构。
     * @function QQMapPlugin.MeasureDistance#start
     */
    MeasureDistance.prototype.start = function () {
        //当用户只点击了一次，没有确定结束点时，清空所有marker和polyline
        if (this._isStart && this._m && this._m.getLength() == 1) {
            this._c.end();
        }
        //已经启动测距状态
        if (this._isStart) {
            return;
        }
        this._isStart = true;
        //使用MVCArray类保存每次点击的latlng值
        this._m = new qq.maps.MVCArray();
        //实例化地图控制类MapController
        this._c = new MapController(this.map);
        //实例化展示类Display
        this._v = new Display(this._m, this.map);

        var self = this;
        /**
         * 私有数组保存注册的监听器
         * @type {Array}
         * @private
         */
        this._listenerArray = [];

        /**
         * 当有点击事件发生时触发
         */
        var listener1 = qq.maps.event.addListener(this._c, "add", function (latlng) {
            self._m.push(latlng);
        });
        this._listenerArray.push(listener1);

        /**
         * 当光标在地图上移动时触发
         */
        var listener2 = qq.maps.event.addListener(this._c, "position_changed", function (latlng) {
            self._v.setCurrentPosition(latlng);
        });
        this._listenerArray.push(listener2);

        /**
         * 当结束测距时触发
         */
        var listener3 = qq.maps.event.addListener(this._c, "end", function () {
            self._isStart = false;
            self._v.end();
        });
        this._listenerArray.push(listener3);

        //同时启动MapController的start方法
        this._c.start();
    };
    /**
     * 关闭地图的测距状态
     * @function QQMapPlugin.MeasureDistance#end
     */
    MeasureDistance.prototype.end = function () {
        this.map.setOptions({
            draggableCursor: 'default'
        });

        if (this._isStart) {
            this._c.end(this);
            this._c = null;
            this._m = null;
            this._v = null;
        }
        //迭代注销监听器
        for (var i = 0, len = this._listenerArray.length; i < len; i++) {
            qq.maps.event.removeListener(this._listenerArray[i]);
            this._listenerArray[i] = null;
        }
        this._listenerArray = null;
    };

    /**
     * 自定义Overlay，用来显示最后一个类似marker的图标
     */
    function CustomOverlay(latlng, str) {
        /**
         * 自定义Overlay的经纬度坐标，由点击传回
         */
        this.latlng = latlng;

        /**
         * 供显示的文本信息
         */
        this.str = str;
    }

    //自定义的Overlay继承自Overlay类
    CustomOverlay.prototype = new qq.maps.Overlay();
    /**
     * 此方法在setMap(map)后自动调用，用于初始化自定义的DOM元素
     */
    CustomOverlay.prototype.construct = function () {
        var div = this.div = document.createElement("div");
        var divStyle = this.div.style;
        divStyle.position = "absolute";
        divStyle.backgroundColor = "#FFFFFF";
        divStyle.border = "1px solid gray";
        divStyle.textAlign = "center";
        divStyle.whiteSpace = "nowrap";
        divStyle.lineHeight = "18px";
        divStyle.fontSize = "5pt";
        divStyle.paddingLeft = "2px";
        divStyle.paddingRight = "2px";

        divStyle.cursor = "default";
        //这个span用于显示表示距离的文本信息
        this.span1 = document.createElement("span");
        //这个span用于删除当前测距路径
        this.span2 = document.createElement("span");
        this.span1.innerHTML = this.str;
        this.span2.innerHTML = '<a href = "javascript:void(0)">(删除)</a>';

        this.div.appendChild(this.span1);
        this.div.appendChild(this.span2);

        var panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(div);


        var self = this;
        //为第二个span注册单击事件，该事件用来删除当前路径
        this.listener = qq.maps.event.addDomListener(this.span2, 'click', function () {
            self.setMap(null);
            //触发del事件，该事件由Display中的监听器接受，负责删除整条路径
            qq.maps.event.trigger(self, "del");
            self = null;
        });

    };
    /**
     * 绘制和更新自定义的DOM元素
     */
    CustomOverlay.prototype.draw = function () {
        var overlayProjection = this.getProjection();
        var pixel = overlayProjection.fromLatLngToDivPixel(this.latlng);
        var divStyle = this.div.style;
        //设置左上位置使显示位置与label保持一致
        divStyle.left = pixel.x + 15 + "px";
        divStyle.top = pixel.y + "px";
    };
    /**
     * 此方法在setMap(null)后自动调用，用于删除自定义的DOM元素
     */
    CustomOverlay.prototype.destroy = function () {
        qq.maps.event.removeListener(this.listener);
        this.span1.parentNode.removeChild(this.span1);
        this.span2.parentNode.removeChild(this.span2);
        this.div.parentNode.removeChild(this.div);
        this.span1 = null;
        this.span2 = null;
        this.div = null;
    };

    /**
     * 将函数绑定到实例
     */
    function bindHandler(handler, instance) {
        return function () {
            handler.apply(instance, arguments);
        }
    }

    /**
     * MapController类的构造函数,控制用户事件
     */
    function MapController(map) {

        this.map = map;
    }

    /**
     * 由MeasureDistance的start调用，注册用户事件
     * @method start
     * @memberof MapController
     */
    MapController.prototype.start = function () {
        /**
         * 该数组保存注册的监听器
         */
        this.mylistenerArray = [];
        /**
         * 用户单击时触发，用于确定测距点
         */
        var mylistener1 = qq.maps.event.addListener(this.map, 'click', bindHandler(this.onClick, this));
        this.mylistenerArray.push(mylistener1);
        /**
         * 用户移动鼠标时触发，用于跟随光标显示当前距离
         */
        var mylistener2 = qq.maps.event.addListener(this.map, 'mousemove', bindHandler(this.onMouseMove, this));
        this.mylistenerArray.push(mylistener2);
        /**
         * 用户点击鼠标右键时触发，用于结束当前测距路径
         */
        var mylistener3 = qq.maps.event.addListener(this.map, 'rightclick', bindHandler(this.onRightClick, this));
        this.mylistenerArray.push(mylistener3);
        /**
         * 用户双击时触发，用于结束当前测距路径
         */
        var mylistener4 = qq.maps.event.addListener(this.map, 'dblclick', bindHandler(this.onDblClick, this));
        this.mylistenerArray.push(mylistener4);
    };
    /**
     * 由MeasureDistance的end调用，迭代删除监听器，并触发end事件给Display
     */
    MapController.prototype.end = function () {
        for (var i = 0, len = this.mylistenerArray.length; i < len; i++) {
            qq.maps.event.removeListener(this.mylistenerArray[i]);
            this.mylistenerArray[i] = null;
        }
        this.mylistenerArray = null;
        qq.maps.event.trigger(this, "end");


    };
    /**
     * 当用户单击时，触发add事件给MeasureDistance
     */
    MapController.prototype.onClick = function (evt) {
        qq.maps.event.trigger(this, "add", evt.latLng);
    };
    /**
     * 当用户移动鼠标时，触发position_changed事件给MeasureDistance
     */
    MapController.prototype.onMouseMove = function (evt) {
        qq.maps.event.trigger(this, "position_changed", evt.latLng);
    };
    /**
     * 当用户右键时，调用实例的end方法，结束当前路径
     */
    MapController.prototype.onRightClick = function () {
        //结束测距，改变鼠标样式为开启测距前样式
        this.map.setOptions({
            draggableCursor: 'default'
        });
        this.end();
    };
    /**
     * 当用户双击时，调用实例的end方法，结束当前路径
     */
    MapController.prototype.onDblClick = function () {
        //结束测距，改变鼠标样式为开启测距前样式，禁用双击放大
        this.map.setOptions({
            draggableCursor: 'default',
            disableDoubleClickZoom: true
        });

        this.end();

    };

    /**
     * Display类的构造函数，用于显示marker、label、polyline、自定义overlay等
     */
    function Display(mvcarray, map) {
        //向mvcarray插入对象时触发
        qq.maps.event.addListener(mvcarray, "insert_at", bindHandler(this.insertAt, this));
        this.map = map;
        this.mvcarray = mvcarray;
        //此数组保存insertAt方法创建的每一个obj，即每一点的marker、label、polyline
        this.objArray = [];
        this.str = '';
        //当用户在地图上移动时，实时显示的对象，随着mousemove而刷新
        this.obj = {
            label: new qq.maps.Label({
                offset: new qq.maps.Size(15, 0),
                map: this.map
            }),
            polyline: new qq.maps.Polyline({

                strokeColor: '#FF0000',
                strokeWeight: 3,
                strokeDashStyle: 'dash',
                editable: false,
                clickable: false,
                map: this.map
            })
        };

    }

    /**
     * 用户点击时创建新的obj对象，该对象显示了marker、label和polyline
     */
    Display.prototype.insertAt = function (latlng, index) {
        var obj = {
            marker: new qq.maps.Marker({
                map: this.map
            }),
            label: new qq.maps.Label({
                offset: new qq.maps.Size(15, 0),
                map: this.map
            }),
            polyline: new qq.maps.Polyline({

                strokeColor: '#00FF00',
                strokeWeight: 3,
                editable: false,
                clickable: false,
                map: this.map
            })

        };
        //显示marker
        this.drawMarker(latlng, obj);
        //显示label
        this.drawLabel(latlng, obj, index);
        //显示polyline
        this.drawPolyline(this.mvcarray, obj);

        this.objArray.push(obj);
    };
    //光标在地图上移动时显示对应的文字
    Display.prototype.setCurrentPosition = function (latlng) {
        //设置光标样式为十字形
        this.map.setOptions({
            draggableCursor: 'crosshair'
        });
        this.obj.label.setPosition(latlng);
        var str = '';
        //尚未点击时的文字
        if (this.mvcarray.getLength() == 0) {
            str = '<b>单击选择起点</b>';
            //点击后
        } else {
            //确定点击前的最后一个点
            var start = this.mvcarray.getAt(this.mvcarray.getLength() - 1);
            //显示最后一条线，随光标移动而刷新
            this.obj.polyline.setPath([start, latlng]);
            this.obj.polyline.setVisible(true);
            //计算从开始点到光标所在位置所经过的路径的总长度
            var distance = qq.maps.geometry.spherical.computeLength(this.mvcarray) + qq.maps.geometry.spherical.computeDistanceBetween(start, latlng);
            //长度小于1000米时单位是米
            if (distance < 1000) {
                str = '<b>当前' + (distance).toFixed(0) + '米</b><br>单击左键继续，双击或右键结束';
            }
            //超过1000米用公里表示
            else {
                str = '<b>当前' + ((distance) / 1000).toFixed(3) + '公里</b><br>单击左键继续，双击或右键结束';
            }
        }
        this.obj.label.setContent(str);


    };
    /**
     * 右键事件发生时执行，删除相应对象
     */
    Display.prototype.end = function () {
        //尚未确定起点时删除光标处的label即可
        if (this.objArray.length == 0) {
            this.obj.label.setMap(null);
            this.obj.label = null;
            this.obj = null;
            //仅确定了起点时删除光标处的label和起点的label和marker
        } else if (this.objArray.length == 1) {
            this.objArray[0].marker.setMap(null);
            this.objArray[0].label.setMap(null);
            this.objArray[0].marker = null;
            this.objArray[0].label = null;
            this.objArray = null;
            this.obj.label.setMap(null);
            this.obj.polyline.setMap(null);
            this.obj.label = null;
            this.obj.polyline = null;
            this.obj = null;
            //确定了两个及以上点时，将最后一个label替换为自定义overlay，并删除最后一条虚线和label
        } else {
            this.obj.label.setMap(null);
            this.obj.polyline.setMap(null);
            this.obj.label = null;
            this.obj.polyline = null;
            this.obj = null;
            this.substitute();
            this.listener = qq.maps.event.addListener(this.overlay, 'del', bindHandler(this.onStop, this));
        }
        var self = this;
        //延时200毫秒后恢复双击放大功能
        setTimeout(function () {
            self.map.setOptions({
                disableDoubleClickZoom: false
            });
        }, 200);


    };
    /**
     * 用户点击‘删除’时，删掉相应路径上的所有点和线，移除监听器
     */
    Display.prototype.onStop = function () {
        //每次循环删除一个点的marker、label和polyline
        for (var i = 0, len = this.objArray.length; i < len; i++) {
            this.objArray[i].marker.setMap(null);
            this.objArray[i].label.setMap(null);
            this.objArray[i].polyline.setMap(null);
            this.objArray[i].marker = null;
            this.objArray[i].label = null;
            this.objArray[i].polyline = null;
        }
        this.objArray = null;
        qq.maps.event.removeListener(this.listener);
    };
    /**
     * 将最后一个label替换为自定义overlay
     */
    Display.prototype.substitute = function () {

        this.objArray[this.objArray.length - 1].label.setMap(null);
        this.overlay = new CustomOverlay(this.mvcarray.getAt(this.mvcarray.getLength() - 1), this.str);
        this.overlay.setMap(this.map);

    };

    //绘制marker
    Display.prototype.drawMarker = function (latlng, obj) {
        obj.marker.setPosition(latlng);
        obj.marker.setMap(this.map);
    };
    //绘制label
    Display.prototype.drawLabel = function (latlng, obj, index) {
        obj.label.setPosition(latlng);
        //未确定起点时
        if (index == 0) {
            this.str = '<b>起点</b>';
            //确定起点后显示相应距离
        } else {
            var distance = qq.maps.geometry.spherical.computeLength(this.mvcarray);

            if (distance < 1000) {
                this.str = '<b>' + (distance).toFixed(0) + '米</b>';
            }
            else {
                this.str = '<b>' + ((distance) / 1000).toFixed(3) + '公里</b>';
            }
        }

        obj.label.setContent(this.str);
        obj.label.setMap(this.map);
    };
    //绘制polyline
    Display.prototype.drawPolyline = function (mvcarray, obj) {
        obj.polyline.setPath(mvcarray);
        obj.polyline.setMap(this.map);
    };


    QQMapPlugin["MeasureDistance"] = MeasureDistance;
})();

