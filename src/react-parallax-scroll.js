// @flow
import React, { PureComponent } from 'react';
import 'intersection-observer';
import throttle from 'lodash.throttle';

type ContainerPropType = {

};

type ContainerStateType = {

};

const ParallaxScrollContext = React.createContext({t: 'testing not connected'});

export class ParallaxScrollContainer extends PureComponent<ContainerPropType, ContainerStateType> {
  state = {
    parallaxElements: new Map(),
    lastKey: 0,
  };
  componentDidMount(){
    window.addEventListener('scroll', throttle(this.onScroll, 10));
  }
  onScroll = () => {
    if(window.outerHeight < 780) return;
    for(let [key,elm] of this.state.parallaxElements){
      elm.onScroll({
        wrapperPosY: (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop),
        wrapperPosX: (window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft),
        screenY: window.innerHeight,
        screenX: window.innerWidth,
      });
    }
  }
  handleNewElm = (elm, cb) => {
    this.setState((prevState)=>{
      let m = new Map(prevState.parallaxElements);
      m.set('key' + m.size, elm);
      cb('key' + m.size);
      return {
        parallaxElements: m,
      };
    }, () => {
      this.onScroll();
    });
  }
  handleRemoveElm = (key) => {
    if(!this.state.parallaxElements.has(key)) return;
    this.setState((prevState => {
      let m = new Map(prevState.parallaxElements);
      m.delete(key);
      return {
        parallaxElements: m,
      };
    }, () => {
      console.log(key + ' was deleted!');
    }));
  }
  render(){
    return (
      <ParallaxScrollContext.Provider value={{
        handleNewElm: this.handleNewElm,
        handleRemoveElm: this.handleRemoveElm,
      }}>
        <div {...this.props}>
          {this.props.children}
        </div>
      </ParallaxScrollContext.Provider>
    );
  }
}
type StartEndPoints = {
  x?: number,
  y?: number,
  z?: number,
  rotateX?: number,
  rotateY?: number,
  rotateZ?: number,
  scale?: number
}

type ElmPropType = {
  className?: string,
  parallax: {
    endPercent?: 1 | 2 | 4,
    start?: StartEndPoints,
    end?: StartEndPoints,
  },
  inview: {
    active?: boolean,
    classNameInView: string,
    classNameNotInView: string,
    viewMargin: string,
    repeatInView: boolean,
  }
};

type ElmStateType = {

};

export class ParallaxScrollElm extends PureComponent<ElmPropType, ElmStateType> {
  state = {};
  render(){
    return (
      <ParallaxScrollContext.Consumer>
        {(provider) => (
          <ParallaxScrollElmConsumer {...this.props} provider={provider} />
        )}
      </ParallaxScrollContext.Consumer>
    );
  }
}

type ConsumerPropType = {
  provider: {},
} & ElmPropType;

type ConsumerStateType = {

};

class ParallaxScrollElmConsumer extends PureComponent<ConsumerPropType, ConsumerStateType> {
  constructor(props) {
    super();

    // INVIEW DEFAULTS
    this.inviewConfig = {
      active: true,
      classNameInView: 'in-view',
      classNameNotInView: 'not-in-view',
      viewMargin: '0px',
      repeatInView: true,
    };

    // Inview Override defaults
    if(props.inview){
      Object.keys(props.inview).map(key => {
        if(!this.inviewConfig[key]) return;
        this.inviewConfig[key] = props.inview[key];
      });
    }

    this.startStyles = props.parallax && props.parallax.start && window.outerWidth > 780 ? props.parallax.start : {};
    this.endStyles = props.parallax && props.parallax.end ? props.parallax.end : {};

    Object.keys(this.endStyles).map(key => {
      if(!this.startStyles[key]){
        this.startStyles[key] = 0;
      }
    });

    this.state = {
      className: this.inviewConfig.active ? this.inviewConfig.classNameNotInView : '',
      style: this.getStyleObj(this.startStyles),
    };

    this.onScroll = this.onScroll.bind(this);
    this.getViewPercentage = this.getViewPercentage.bind(this);

  }
  componentDidMount(){
    if(this.props.provider.handleNewElm && this.props.parallax){
      let self = this;
      this.props.provider.handleNewElm(this, (key)=>{
        self.key = key;
      });
    }

    if(!this.inviewConfig.active) return;
    if (!window.IntersectionObserver) {
      console.error('No support for IntersectionObserver. Use a polyfill like: https://cdn.polyfill.io/v2/polyfill.js?features=IntersectionObserver');
      return;
    }
    let options = {
      rootMargin: this.inviewConfig.viewMargin,
    };

    this.observer = new IntersectionObserver(
      this.observerEntriesCheck,
      options
    );

    this.observer.observe(this._elm);
  }
  componentWillUnmount() {
    this.observer && this.observer.disconnect()
    this.props.provider && this.props.provider.handleRemoveElm(this.key);
  }
  setRef = (elm) => {
    this._elm = elm;
  }
  observerEntriesCheck = (entries: Array<IntersectionObserverEntry>) => {
    entries.map(entry => {
      if(entry.target !== this._elm) return;

      if(entry.isIntersecting){
        // Is in view
        this.setState({
          className: this.inviewConfig.classNameInView,
        });
        if(!this.inviewConfig.repeatInView){
          this.observer.unobserve(entry.target);
        }
      }else{
        // Not in view
        this.setState({
          className: this.inviewConfig.classNameNotInView,
        });
      }
    });
  }
  onScroll = (wrapperPosition) => {
    // console.log("scrolled from " + this.key);
    // console.log('y: ' + wrapperPosY + '  x:' + wrapperPosX);
    let inprogressStyles = {};

    let percentages = this.getViewPercentage(wrapperPosition);

    Object.keys(this.endStyles).map(key => {
      inprogressStyles[key] = this.startStyles[key] + ((this.endStyles[key] - this.startStyles[key]) * percentages.y)
    });

    this.setState({
      style: this.getStyleObj(inprogressStyles),
    });
  }
  getViewPercentage = ({wrapperPosY, wrapperPosX, screenY, screenX}) => {
    let elmTop, elmHeight, elmLeft, elmWidth, x, y, d;

    elmTop = wrapperPosY + this._elm.getBoundingClientRect().top;
    elmHeight = this._elm.clientHeight || this._elm.offsetHeight || this._elm.scrollHeight;

    // elmLeft = wrapperPosX + this._elm.getBoundingClientRect().left;
    // elmWidth = this._elm.clientWidth || this._elm.offsetWidth || this._elm.scrollWidth;
    d = this.props.parallax && this.props.parallax.endPercent ? this.props.parallax.endPercent : 1;
    y = ((wrapperPosY - elmTop + screenY) / ((elmHeight + screenY) / d));
    // x = ((wrapperPosX - elmLeft + screenX) / (elmWidth + screenX));

    return {
      y: Math.min(1, Math.max(-1, y)),
      // x: Math.min(1, Math.max(-1, x)),
    };
  }
  getStyleObj = (stylePoints: StartEndPoints) => {
    let style = '';
    Object.keys(stylePoints).map(key => {
      switch(key){
        case 'x':
          style = style + ` translateX(${stylePoints[key]}px)`;
          break;
        case 'y':
          style = style + ` translateY(${stylePoints[key]}px)`;
          break;
        case 'z':
          style = style + ` translateZ(${stylePoints[key]}px)`;
          break;
        case 'rotateX':
          style = style + ` rotateX(${stylePoints[key]}deg)`;
          break;
        case 'rotateY':
          style = style + ` rotateY(${stylePoints[key]}deg)`;
          break;
        case 'rotateZ':
          style = style + ` rotateZ(${stylePoints[key]}deg)`;
          break;
        case 'scale':
          style = style + ` scale(${stylePoints[key]})`;
          break;
      }
    });
    // console.log(this._elm && this._elm.style.position);
    return {
      // position: (this._elm && this._elm.style.position) ? this._elm.style.position : 'relative',
      transform: style,
    }
  }

  render(){
    // console.log(this);
    return (
      <div
        ref={this.setRef}
        style={this.state.style}
        className={(
          this.props.className
            ? this.props.className  + ' '
            : '') + this.state.className}>
        {this.props.children}
      </div>
    );
  }
}
