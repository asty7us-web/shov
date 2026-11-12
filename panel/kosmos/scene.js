/* «Панель» · тема «Космос» · 3D-сцена «Орбита». WebGL без библиотек.
   Небо, звёзды, Земля и Луна — настоящие карты и снимки NASA (как готовятся и откуда — panel_sayt\kosmos_nasa.py).
   Солнце, Луна и линия дня и ночи стоят так, как сейчас на самом деле (упрощённые формулы, точность около градуса);
   расстояние до Луны сокращено, а её размер на небе увеличен — для вида.
   Файл грузится только при включённой теме «Космос». Проба: kosmos\proba.html, проверка: panel_sayt\test_kosmos.py.
   Снаружи: KOSMOS.start({base,tab,launch,onReady,onFail}) · stop() · go(tab) · shift(±1) · zoom(true|false) · launch() · pause(причина,да) · state() */
(function(){
'use strict';
if(window.KOSMOS)return;
const PI=Math.PI,TAU=PI*2,DEG=PI/180;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l]},
  mix=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>x<a?a:x>b?b:x,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)},
  ease=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
const rotAx=(v,ax,ang)=>{const c=Math.cos(ang),s=Math.sin(ang),d=dot(ax,v),x=cross(ax,v);return [v[0]*c+x[0]*s+ax[0]*d*(1-c),v[1]*c+x[1]*s+ax[1]*d*(1-c),v[2]*c+x[2]*s+ax[2]*d*(1-c)]};
/* кватернионы [x,y,z,w]: камера смотрит вдоль −Z, верх +Y */
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot=(q,v)=>{const x=q[0],y=q[1],z=q[2],w=q[3],tx=2*(y*v[2]-z*v[1]),ty=2*(z*v[0]-x*v[2]),tz=2*(x*v[1]-y*v[0]);return [v[0]+w*tx+y*tz-z*ty,v[1]+w*ty+z*tx-x*tz,v[2]+w*tz+x*ty-y*tx]};
const qaxis=(ax,ang)=>{const s=Math.sin(ang/2);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(ang/2)]};
const qslerp=(a,b,t)=>{let c=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],s=1;if(c<0){c=-c;s=-1}let ka,kb;
  if(c>.9995){ka=1-t;kb=t}else{const th=Math.acos(c),sn=Math.sin(th);ka=Math.sin((1-t)*th)/sn;kb=Math.sin(t*th)/sn}
  kb*=s;const q=[a[0]*ka+b[0]*kb,a[1]*ka+b[1]*kb,a[2]*ka+b[2]*kb,a[3]*ka+b[3]*kb],l=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/l,q[1]/l,q[2]/l,q[3]/l]};
function qlook(f,upH){let r=cross(f,upH);if(len(r)<1e-4)r=cross(f,[1,0,0]);r=norm(r);const u=cross(r,f),b=[-f[0],-f[1],-f[2]];
  const m00=r[0],m01=u[0],m02=b[0],m10=r[1],m11=u[1],m12=b[1],m20=r[2],m21=u[2],m22=b[2],tr=m00+m11+m22;let x,y,z,w,s;
  if(tr>0){s=Math.sqrt(tr+1)*2;w=s/4;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s}
  else if(m00>m11&&m00>m22){s=Math.sqrt(1+m00-m11-m22)*2;w=(m21-m12)/s;x=s/4;y=(m01+m10)/s;z=(m02+m20)/s}
  else if(m11>m22){s=Math.sqrt(1+m11-m00-m22)*2;w=(m02-m20)/s;x=(m01+m10)/s;y=s/4;z=(m12+m21)/s}
  else{s=Math.sqrt(1+m22-m00-m11)*2;w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=s/4}
  return [x,y,z,w]}

/* ───────── где сейчас Солнце и Луна, как повёрнута Земля ─────────
   Направление в мире = на небе: (cos δ·cos α, sin δ, −cos δ·sin α); ось Y — к северному полюсу мира. */
const dirRD=(ra,de)=>[Math.cos(de)*Math.cos(ra),Math.sin(de),-Math.cos(de)*Math.sin(ra)];
function astro(ms){
  const n=ms/864e5+2440587.5-2451545,T=n/36525,R=DEG,sn=x=>Math.sin(x*R);
  const g=(357.528+.9856003*n)*R,lam=(280.46+.9856474*n)*R+(1.915*Math.sin(g)+.02*Math.sin(2*g))*R,eps=(23.439-4e-7*n)*R;
  const eq=(l,b)=>{const x=Math.cos(b)*Math.cos(l),y=Math.cos(eps)*Math.cos(b)*Math.sin(l)-Math.sin(eps)*Math.sin(b),z=Math.sin(eps)*Math.cos(b)*Math.sin(l)+Math.cos(eps)*Math.sin(b);return [x,z,-y]};
  const ml=(218.32+481267.881*T+6.29*sn(135+477198.87*T)-1.27*sn(259.3-413335.36*T)+.66*sn(235.7+890534.22*T)+.21*sn(269.9+954397.74*T)-.19*sn(357.5+35999.05*T)-.11*sn(186.5+966404.03*T))*R;
  const mb=(5.13*sn(93.3+483202.02*T)+.28*sn(228.2+960400.89*T)-.28*sn(318.3+6003.15*T)-.17*sn(217.6-407332.21*T))*R;
  return {sun:eq(lam,0),moon:eq(ml,mb),gmst:(((280.46061837+360.98564736629*n)%360+360)%360)*R}}

/* ───────── настройки ───────── */
const MD=20,RM=.384;                       // Луна: расстояние и радиус в радиусах Земли (на деле 60,3 и 0,273 — сближено для вида)
const GC=dirRD(266.4*DEG,-29*DEG),GT=norm(cross(dirRD(192.86*DEG,27.13*DEG),GC));   // центр Галактики и направление вдоль Млечного Пути
const FOV=78*DEG;                          // угол обзора по длинной стороне экрана
const TABS=['sum','cat','skl','prod','spp','year'];
const PR=10;                               // половина куба ближних «пылинок»

let cv=null,gl=null,G=null,opt={},on=false,raf=0,last=0,T=0,frames=0,ready=false,failed='',calm=false,manual=false;
let W=0,H=0,cssW=0,cssH=0,scale=1,scaleMax=1,tier='m',slowN=0,fastN=0,fps=0,fpsA=0;
let A=null,aAt=0,env=null,tab='sum',tr=null,cam={p:[0,0,3],q:[0,0,0,1],tan:[1,1],fov:FOV},trail={q:[0,0,0,1]};
let phase=0,phaseT=0,zoom=0,zoomT=0,warp=0,haze=0,hazeCol=[.3,.5,.9],fadeIn=0;
let off=[0,0,0],offTrail=[0,0,0],par=[0,0],slide=0,slideT=0;
const inp={mx:0,my:0,tx:0,ty:0,sc:0,scy:0},sm={yaw:0,pitch:0,sc:0,kick:0,roll:0};
let tiltBase=null,tiltAsk=0,pauses={},launchW=false;
const look={on:false,y:0,p:0,ty:0,tp:0};let sys=null,sysN=0;   // «Погружение»: человек сам поворачивает взгляд
const TEX={},loaded={};

/* ───────── ракурсы: у каждого раздела своё место ───────── */
const tans=(fov,asp)=>{const t=Math.tan(fov/2);return asp>=1?[t,t/asp]:[t*asp,t]};
function aim(p,target,upH,cx,cy,tn){   // смотреть так, чтобы цель оказалась в точке экрана (cx, cy), −1…1
  const f0=norm(sub(target,p));let r0=cross(f0,upH);if(len(r0)<1e-4)r0=cross(f0,[1,0,0]);r0=norm(r0);const u0=cross(r0,f0);
  return norm(sub(sub(f0,mul(r0,cx*tn[0])),mul(u0,cy*tn[1])))}
function orbit(o){   // полёт по орбите вокруг Земли, взгляд вперёд, горизонт на заданной высоте экрана
  return (t,e)=>{const S=e.S,Wv=norm(cross(S,[0,1,0])),Q=cross(Wv,S),ci=Math.cos(o.inc),si=Math.sin(o.inc);
    const N=norm(add(mul(Q,ci),mul(S,si))),B=cross(N,Wv),dip=Math.acos(1/o.r);
    const rise=Math.asin(clamp(-Math.sin(dip)/ci,-1,1));                       // здесь впереди из-за края Земли встаёт Солнце
    const ph=rise+o.lead+t/o.T*TAU+e.phase;
    const up=add(mul(Wv,Math.cos(ph)),mul(B,Math.sin(ph))),vel=add(mul(Wv,-Math.sin(ph)),mul(B,Math.cos(ph)));
    const tn=tans(o.fov,e.asp),hy=o.hy+e.sc*o.hys,pitch=-dip-Math.atan(hy*tn[1]);
    let f=add(mul(vel,Math.cos(pitch)),mul(up,Math.sin(pitch)));f=rotAx(f,up,o.yaw);
    return {p:mul(up,o.r),f,up,fov:o.fov}}}
const RIG={
  sum:orbit({r:1.32,T:480,inc:-10*DEG,lead:-14/480*TAU,hy:-.40,hys:.34,yaw:-5*DEG,fov:FOV}),          // «Сводка»: орбита, впереди рассвет
  prod:orbit({r:1.13,T:400,inc:38*DEG,lead:-2.2,hy:.22,hys:.25,yaw:0,fov:FOV}),                      // «Товары»: низко над ночной стороной
  cat:(t,e)=>{const S=e.S,Wv=norm(cross(S,[0,1,0])),Q=cross(Wv,S),ang=1.2+.22*Math.sin(t*TAU/420)+e.phase*.6;   // «Категории»: весь шар, день и ночь пополам
    const dir=norm(add(add(mul(S,Math.cos(ang)),mul(Wv,Math.sin(ang))),mul(Q,.3))),tn=tans(FOV,e.asp),r=1/Math.sin(Math.atan(Math.min(tn[0],tn[1])*.8));
    const p=mul(dir,r),land=e.asp>=1;
    return {p,f:aim(p,[0,0,0],[0,1,0],land?.42:0,(land?-.12:-.36)+e.sc*.3,tn),up:[0,1,0],fov:FOV}},
  skl:(t,e)=>{const M=e.M,E=norm(mul(M,-1));let n=sub(e.S,mul(E,dot(e.S,E)));n=len(n)<.05?norm(cross(E,[0,1,0])):norm(n);   // «Склейки»: восход Земли над Луной
    const near=sstep(.15,.5,dot(e.S,E)),a=mix(-.33,.2,near)+.085*Math.sin(t*TAU/80)+e.phase*.35;
    const k=norm(add(mul(n,Math.cos(a)),mul(E,Math.sin(a)))),p=add(M,mul(k,RM*1.17)),tn=tans(FOV,e.asp);
    const dip=Math.acos(1/1.17),side=norm(cross(k,E)),hor=norm(cross(side,k));                          // hor — вдоль поверхности в сторону Земли
    const pitch=-dip-Math.atan((-.44+e.sc*.3)*tn[1]);
    return {p,f:add(mul(hor,Math.cos(pitch)),mul(k,Math.sin(pitch))),up:k,fov:FOV}},
  spp:(t,e)=>{const M=e.M,S=e.S,E=norm(mul(M,-1));let m=sub(E,mul(S,dot(E,S)));m=len(m)<.05?norm(cross(S,[0,1,0])):norm(m);   // «СПП»: вдоль границы света и тени на Луне
    m=rotAx(m,S,t*TAU/900+e.phase*.5);const k=norm(add(m,mul(S,.42))),p=add(M,mul(k,RM*1.4)),tn=tans(FOV,e.asp);
    const dip=Math.acos(1/1.4),hor=norm(cross(k,S)),pitch=-dip-Math.atan((.02+e.sc*.3)*tn[1]);         // Солнце сбоку — рельеф виден по теням
    return {p,f:add(mul(hor,Math.cos(pitch)),mul(k,Math.sin(pitch))),up:k,fov:FOV}},
  year:(t,e)=>{const S=e.S;let best=null,bs=-9;                                                           // «Год»: взгляд издалека, за Землёй Млечный Путь
    for(let l=-180;l<180;l+=6){const v=add(mul(GC,Math.cos(l*DEG)),mul(GT,Math.sin(l*DEG))),lit=-dot(v,S);if(lit<.22)continue;const sc=Math.cos(l*DEG)+lit*.6;if(sc>bs){bs=sc;best=v}}
    if(!best)best=mul(S,-1);const dir=rotAx(mul(best,-1),[0,1,0],.05*Math.sin(t*TAU/500)+e.phase*.3),p=mul(dir,21),fov=62*DEG,tn=tans(fov,e.asp),land=e.asp>=1;
    return {p,f:aim(p,[0,0,0],[0,1,0],land?.34:0,(land?-.08:-.34)+e.sc*.25,tn),up:[0,1,0],fov}}};

/* ───────── шейдеры ───────── */
const HDR='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#define TAU 6.2831853\n#define ITAU .15915494\n#define IPI .31830989\n';
const VS_FULL='attribute vec2 a_p;varying vec2 v_n;void main(){v_n=a_p;gl_Position=vec4(a_p,0.,1.);}';
const RAY='uniform vec3 u_r,u_u,u_f;uniform vec2 u_tan;varying vec2 v_n;vec3 ray(){return normalize(u_f+v_n.x*u_tan.x*u_r+v_n.y*u_tan.y*u_u);}\n';
const FS_SKY=RAY+`uniform sampler2D u_mw;uniform float u_mwOn,u_gain,u_warp,u_t;uniform vec3 u_sun;uniform vec2 u_sc;
void main(){vec3 d=ray();float ra=atan(-d.z,d.x),de=asin(clamp(d.y,-1.,1.));
  vec3 m=texture2D(u_mw,vec2(.5-ra*ITAU,.5-de*IPI)).rgb*u_mwOn;float l=dot(m,vec3(.3,.5,.2));
  vec3 c=m*mix(vec3(.46,.6,1.32),vec3(1.22,.95,1.14),smoothstep(.12,.72,l))*(.82+.3*l)*u_gain;c=c/(1.+.42*c);   // холодные края, тёплая середина Млечного Пути
  c+=vec3(.006,.008,.022);
  float cs=dot(d,u_sun),a=acos(clamp(cs,-1.,1.));
  c+=vec3(1.,.95,.86)*(smoothstep(.0125,.0085,a)*6.+.9*exp(-a*52.)+.2*exp(-a*11.)+.05*exp(-a*3.4));
  float rr=length(v_n*u_sc);c+=vec3(.3,.42,1.)*u_warp*u_warp*(.07+.5*exp(-rr*rr*3.2));
  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.012;
  gl_FragColor=vec4(c,1.);}`;
const VS_STAR=`attribute vec3 a_dir;attribute vec4 a_col;attribute float a_end;uniform mat4 u_vp,u_vpT;uniform float u_dpr,u_warp,u_t,u_line,u_fade;varying vec4 v_c;
void main(){vec4 a=u_vp*vec4(a_dir,0.);float m=a_col.a;
  if(u_line>.5){vec4 b=u_vpT*vec4(a_dir,0.);b.xy*=1.-.3*u_warp;gl_Position=mix(a,b,a_end);gl_PointSize=1.;
    v_c=vec4(a_col.rgb,(.3+.7*m)*(1.-a_end)*min(1.,u_warp*3.)*u_fade);}
  else{gl_Position=a;float tw=.93+.07*sin(u_t*(1.1+m*2.7)+a_dir.x*40.+a_dir.z*17.);
    gl_PointSize=(1.3+3.1*m*m+4.2*pow(m,7.))*u_dpr;v_c=vec4(a_col.rgb,(.26+.74*m)*tw*u_fade);}}`;
const VS_PART=`attribute vec3 a_dir;attribute vec4 a_col;attribute float a_end;uniform mat4 u_vp;uniform vec3 u_o,u_oT;uniform float u_R,u_dpr,u_warp,u_line,u_fade;varying vec4 v_c;
void main(){vec3 p=mod(a_dir-u_o+u_R,2.*u_R)-u_R;vec3 x=p+(u_o-u_oT)*a_end*u_line;float ds=length(p),s=a_col.a;
  float f=smoothstep(u_R,u_R*.55,ds)*smoothstep(.3,1.3,ds);gl_Position=u_vp*vec4(x,1.);
  gl_PointSize=clamp((.8+1.5*s)*u_dpr*2.4/max(ds,.6),1.,5.*u_dpr);
  v_c=vec4(a_col.rgb,(.1+.42*s)*f*u_fade*(u_line>.5?(1.-a_end)*1.6:1.));}`;
const FS_PT='uniform float u_line;varying vec4 v_c;void main(){float a=1.;if(u_line<.5){vec2 q=gl_PointCoord-.5;a=exp(-dot(q,q)*15.);}gl_FragColor=vec4(v_c.rgb*v_c.a*a,0.);}';
const BODY=RAY+`uniform vec3 u_c,u_sun;uniform float u_R,u_px,u_fade;
float hitSphere(vec3 d,out float b,out float h2){b=dot(d,u_c);h2=dot(u_c,u_c)-b*b;return clamp((u_R-sqrt(max(h2,0.)))/(max(b,1e-4)*u_px)+.5,0.,1.)*step(0.,b);}\n`;
const FS_EARTH=BODY+`uniform sampler2D u_day,u_cloud,u_night;uniform float u_dayOn,u_cloudOn,u_nightOn,u_gmst,u_cl,u_tw;
void main(){vec3 d=ray();float b,h2;float cover=hitSphere(d,b,h2);float h=sqrt(max(h2,0.));
  vec3 nt=normalize(d*b-u_c);float mut=dot(nt,u_sun),fwd=max(dot(d,u_sun),0.);
  vec3 dayA=vec3(.26,.56,1.),duskA=vec3(1.,.4,.13);
  float alt=max(h-u_R,0.)/u_R,g=exp(-alt*70.)*.95+exp(-alt*19.)*.22+exp(-alt*5.)*.035;
  float lit=smoothstep(-.3,.02,mut);
  vec3 glow=(mix(duskA,dayA,smoothstep(-.1,.2,mut))*lit+vec3(1.,.66,.36)*pow(fwd,14.)*lit*2.6+vec3(.02,.035,.09)*(1.-lit))*g*step(0.,b);
  vec3 col=vec3(0.);
  if(cover>0.){float t=b-sqrt(max(u_R*u_R-h2,0.));vec3 n=normalize(d*t-u_c);float mu=dot(n,u_sun),ndv=max(dot(n,-d),0.);
    float lat=asin(clamp(n.y,-1.,1.)),lon=atan(-n.z,n.x)-u_gmst;vec2 uv=vec2(.5+lon*ITAU,clamp(.5-lat*IPI,.001,.999));
    float lod=log2(max(u_tw*ITAU*u_px*t/(u_R*max(ndv,.1)),1.));
    vec3 dg=mix(vec3(.05,.12,.3),TEXLOD(u_day,uv,lod).rgb,u_dayOn);
    float water=smoothstep(.03,.12,dg.b-dg.r)*step(dg.g,dg.b+.03);vec3 day=pow(dg,vec3(2.2));
    float cl=TEXLOD(u_cloud,vec2(uv.x+u_cl,uv.y),lod).r*u_cloudOn,ca=smoothstep(.1,.8,cl);
    float nl=TEXLOD(u_night,uv,lod).r*u_nightOn;
    float dl=smoothstep(-.1,.22,mu),sh=.16+1.22*pow(max(mu,0.),.6);
    vec3 sunC=mix(vec3(1.,.6,.36),vec3(1.,.97,.92),smoothstep(-.06,.14,mu));
    vec3 s=day*sunC*sh*dl*1.15;
    s=mix(s,sunC*(.22+.84*pow(max(mu,0.),.5))*dl,ca*.94);
    vec3 hv=normalize(u_sun-d);s+=sunC*(pow(max(dot(n,hv),0.),260.)*.9+pow(max(dot(n,hv),0.),40.)*.12)*water*(1.-ca)*dl;
    float rim=pow(1.-ndv,3.);
    vec3 atm=mix(duskA,dayA,smoothstep(-.1,.1,mu))*smoothstep(-.24,.04,mu);
    s=s*(1.-.55*rim*dl)+atm*rim*mix(.5,.85,smoothstep(-.1,.1,mu))+atm*.045*dl;
    float ng=1.-dl;
    s+=vec3(1.,.72,.4)*pow(nl,1.25)*2.4*ng*(1.-.8*ca)+(day*.02+vec3(.0025,.005,.014)+vec3(.02,.03,.05)*ca*.25)*ng;
    col=pow(clamp(s,0.,1.),vec3(.4545));}
  gl_FragColor=vec4((col*cover+glow*(1.-cover))*u_fade,cover*u_fade);}`;
const FS_MOON=BODY+`uniform sampler2D u_alb,u_nrm;uniform float u_albOn,u_nrmOn,u_tw,u_nw,u_shine;uniform mat3 u_mrot;
float SL(vec2 uv,float l){float v=2.*TEXLOD(u_nrm,uv,l).r-1.;return .25*v/max(1.-abs(v),.02);}
void main(){vec3 d=ray();float b,h2;float cover=hitSphere(d,b,h2);vec3 col=vec3(0.);
  if(cover>0.){float t=b-sqrt(max(u_R*u_R-h2,0.));vec3 n=normalize(d*t-u_c);float ndv=max(dot(n,-d),0.);
    vec3 nm=u_mrot*n;float lat=asin(clamp(nm.y,-1.,1.)),lon=atan(-nm.z,nm.x);vec2 uv=vec2(.5+lon*ITAU,clamp(.5-lat*IPI,.004,.996));
    float fp=ITAU*u_px*t/(u_R*max(ndv,.1)),lod=log2(max(u_tw*fp,1.)),ln=log2(max(u_nw*fp,1.));
    float alb=mix(.42,TEXLOD(u_alb,uv,lod).r,u_albOn);
    float se=SL(vec2(uv.x,uv.y*.5),ln),sn=SL(vec2(uv.x,.5+uv.y*.5),ln);                    // рельеф: наклон к востоку и к северу
    float sl=sin(lon),cl=cos(lon),sa=sin(lat),ca=cos(lat);
    vec3 E=vec3(-sl,0.,-cl),N=vec3(-sa*cl,ca,sa*sl);
    vec3 n2=normalize(nm-(E*se+N*sn)*1.3*u_nrmOn)*u_mrot;
    float mu0=dot(n,u_sun),mu=dot(n2,u_sun);
    float li=smoothstep(-.03,.07,mu0)*pow(max(mu,0.),.85);
    vec3 s=vec3(1.,.965,.92)*pow(alb,2.2)*(li*1.55+.012)+vec3(.55,.7,1.)*pow(alb,1.6)*u_shine*(1.-smoothstep(-.1,.12,mu0));
    col=pow(clamp(s,0.,1.),vec3(.4545));}
  gl_FragColor=vec4(col*cover*u_fade,cover*u_fade);}`;
const FS_FLARE=`varying vec2 v_n;uniform vec2 u_s,u_sc;uniform vec3 u_col;uniform float u_k,u_t;
void main(){vec2 q=(v_n-u_s)*u_sc;float r=length(q),an=atan(q.y,q.x);
  float g=.46*exp(-r*r*26.)+.13*exp(-r*3.3)+exp(-abs(q.y)*52.)*exp(-abs(q.x)*2.3)*.4;
  g+=(pow(.5+.5*sin(an*7.+u_t*.09),7.)*.55+pow(.5+.5*sin(an*11.-u_t*.06+1.3),11.)*.4)*exp(-r*4.6)*.5;
  gl_FragColor=vec4(u_col*g*u_k,0.);}`;
const FS_HAZE='varying vec2 v_n;uniform vec3 u_col;uniform float u_k;void main(){float a=u_k*(.62+.38*smoothstep(.7,-1.,v_n.y));gl_FragColor=vec4(u_col*a,a);}';
const FS_SYS=RAY+`uniform vec3 u_o;uniform vec4 u_p[8];uniform vec3 u_k[8];uniform float u_q[8];uniform float u_n,u_ring,u_px,u_t,u_fade;
void main(){vec3 d=ray();vec3 col=vec3(0.);float al=0.,tmin=1e9;
  float bs=dot(d,-u_o),hs=sqrt(max(dot(u_o,u_o)-bs*bs,0.));
  vec3 glow=vec3(1.,.8,.52)*(exp(-hs*hs*110.)*1.5+exp(-hs*8.)*.3+exp(-hs*2.4)*.06);                 // «солнце» в середине
  float tp=d.y<-1e-4?-u_o.y/d.y:-1.;vec3 qp=u_o+d*tp;float rho=length(qp.xz),lw=max(tp*u_px*1.4,.004);
  for(int i=0;i<8;i++){if(float(i)>=u_n)break;
    vec3 c=u_p[i].xyz-u_o;float R=u_p[i].w,b=dot(d,c),h2=dot(c,c)-b*b,hh=sqrt(max(h2,0.));
    float cov=clamp((R-hh)/(max(b,1e-4)*u_px)+.5,0.,1.)*step(0.,b);
    if(tp>0.)glow+=vec3(.5,.56,1.)*.2*smoothstep(lw,0.,abs(rho-u_q[i]));                            // линия орбиты
    glow+=u_k[i]*exp(-max(hh-R,0.)/R*7.)*.28*step(0.,b)*(1.-cov);                                    // свечение атмосферы
    float ts=b-sqrt(max(R*R-h2,0.));
    if(cov>0.&&ts<tmin){vec3 n=normalize(d*ts-c),L=normalize(-(u_o+d*ts));float mu=dot(n,L),ndv=max(dot(n,-d),0.);
      float band=.5+.5*sin(n.y*13.+sin(n.y*5.+float(i)*1.3+u_t*.05)*2.2+float(i)*1.7);
      vec3 s=u_k[i]*(.5+.5*band)*(.07+1.05*smoothstep(-.2,.65,mu))+u_k[i]*pow(1.-ndv,3.)*.45;
      col=mix(col,s,cov);al=max(al,cov);tmin=ts;}
    if(float(i)==u_ring){vec3 N=normalize(vec3(.28,1.,.1));float dn=dot(d,N);                         // кольцо у самой большой
      if(abs(dn)>1e-4){float tr=dot(c,N)/dn;if(tr>0.){float rr=length(d*tr-c)/R;
        float ra=smoothstep(1.3,1.42,rr)*smoothstep(2.3,2.12,rr)*(.5+.5*sin(rr*36.))*.62;
        if(cov>.5&&ts<tr)ra=0.;col=mix(col,u_k[i]*.75+.25,ra);al=max(al,ra);}}}
  }
  gl_FragColor=vec4((col+glow*(1.-al))*u_fade,al*u_fade);}`;

function conv300(s,frag){s=s.replace(/\battribute\b/g,'in').replace(/\btexture2D\b/g,'texture');
  return frag?s.replace(/\bvarying\b/g,'in').replace(/\bgl_FragColor\b/g,'o_c'):s.replace(/\bvarying\b/g,'out')}
function prog(vs,fs){const g=gl;let v=HDR+vs,f=HDR+fs;
  if(G.v2){v='#version 300 es\n'+conv300(v,false);f='#version 300 es\n'+conv300(HDR+'#define TEXLOD(s,u,l) textureLod(s,u,l)\nout vec4 o_c;\n'+fs,true)}
  else f=(G.lod?'#extension GL_EXT_shader_texture_lod : enable\n':'')+HDR+(G.lod?'#define TEXLOD(s,u,l) texture2DLodEXT(s,u,l)\n':'#define TEXLOD(s,u,l) texture2D(s,u)\n')+fs;
  const mk=(t,src)=>{const sh=g.createShader(t);g.shaderSource(sh,src);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw new Error('шейдер: '+g.getShaderInfoLog(sh));return sh};
  const p=g.createProgram();g.attachShader(p,mk(g.VERTEX_SHADER,v));g.attachShader(p,mk(g.FRAGMENT_SHADER,f));
  ['a_p','a_dir','a_col','a_end'].forEach((n,i)=>g.bindAttribLocation(p,i,n));g.linkProgram(p);
  if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error('сборка: '+g.getProgramInfoLog(p));
  const U={},nu=g.getProgramParameter(p,g.ACTIVE_UNIFORMS);for(let i=0;i<nu;i++){const n=g.getActiveUniform(p,i).name;U[n]=g.getUniformLocation(p,n)}
  return {p,U}}

/* ───────── подготовка WebGL ───────── */
function initGL(){
  const o={alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:false};
  gl=cv.getContext('webgl2',o);G={v2:!!gl};
  if(!gl){gl=cv.getContext('webgl',o)||cv.getContext('experimental-webgl',o);if(!gl)throw new Error('нет WebGL')}
  G.lod=G.v2||!!gl.getExtension('EXT_shader_texture_lod');G.max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision<20)throw new Error('мало точности');
  G.sky=prog(VS_FULL,FS_SKY);G.star=prog(VS_STAR,FS_PT);G.part=prog(VS_PART,FS_PT);G.earth=prog(VS_FULL,FS_EARTH);G.moon=prog(VS_FULL,FS_MOON);
  G.flare=prog(VS_FULL,FS_FLARE);G.haze=prog(VS_FULL,FS_HAZE);G.sys=prog(VS_FULL,FS_SYS);
  G.tri=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,G.tri);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  // ближние «пылинки»: случайные точки в кубе вокруг камеры — они смещаются относительно далёких звёзд
  const np=tier==='d'?2600:1500;let sd=20261112;const rnd=()=>(sd=sd*48271%2147483647)/2147483647;
  const pp=new Float32Array(np*8),pl=new Float32Array(np*16);
  for(let i=0;i<np;i++){const x=(rnd()*2-1)*PR,y=(rnd()*2-1)*PR,z=(rnd()*2-1)*PR,s=Math.pow(rnd(),2.2),w=rnd(),c=[mix(.72,1,w),mix(.82,.93,w),mix(1,.84,w)];
    pp.set([x,y,z,c[0],c[1],c[2],s,0],i*8);pl.set([x,y,z,c[0],c[1],c[2],s,0,x,y,z,c[0],c[1],c[2],s,1],i*16)}
  G.pp=buf(pp);G.pl=buf(pl);G.np=np;
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  for(const k in TEX)if(TEX[k].img)upload(k);
  if(G.starRaw)stars(G.starRaw)}
function buf(a){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b}
function stars(raw){   // stars.bin: «KSTR», число, потом по звезде: направление (3×int16), цвет (3 байта), блеск (байт); по убыванию блеска
  const dv=new DataView(raw);if(dv.getUint32(0,true)!==0x5254534b)return;const n=dv.getUint32(4,true),nl=Math.min(n,tier==='d'?2600:1500);
  const sp=new Float32Array(n*8),sl=new Float32Array(nl*16);
  for(let i=0;i<n;i++){const o=8+i*10,v=[dv.getInt16(o,true)/32767,dv.getInt16(o+2,true)/32767,dv.getInt16(o+4,true)/32767,dv.getUint8(o+6)/255,dv.getUint8(o+7)/255,dv.getUint8(o+8)/255,dv.getUint8(o+9)/255];
    sp.set(v,i*8);if(i<nl){sl.set(v,i*16);sl.set(v,i*16+8);sl[i*16+15]=1}}
  G.sp=buf(sp);G.sl=buf(sl);G.ns=n;G.nsl=nl;G.starRaw=raw}
function upload(k){const t=TEX[k],g=gl;if(!t.img||!gl)return;const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
  const fmt=t.gray?g.LUMINANCE:g.RGB;g.pixelStorei(g.UNPACK_ALIGNMENT,1);g.texImage2D(g.TEXTURE_2D,0,fmt,fmt,g.UNSIGNED_BYTE,t.img);
  const mip=t.mip&&G.lod;if(mip)g.generateMipmap(g.TEXTURE_2D);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,mip?g.LINEAR_MIPMAP_LINEAR:g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
  t.tex=tex;t.w=t.img.naturalWidth||t.img.width;t.t0=T}
function loadAll(){   // по очереди, от главного к второстепенному; сцена видна сразу и «проявляется» по мере загрузки
  const base=opt.base||'',big=tier==='d'&&G.max>=4096,a=big?'4k':'2k';
  const list=[['mw','mw-'+a+'.webp',0,0],['day','earth-'+a+'.webp',0,1],['cloud','cloud-'+a+'.webp',1,1],['night','night-'+a+'.webp',1,1],['alb','moon-'+a+'.webp',1,1],['nrm','moonn-'+(big?'2k':'1k')+'.webp',1,1]];
  fetch(base+(tier==='d'?'stars-d.bin':'stars.bin')).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(b=>{if(on&&gl){stars(b);loaded.stars=1;kick()}}).catch(()=>{loaded.stars=0});
  let i=0;const next=()=>{if(!on||i>=list.length)return;const [k,fn,gray,mip]=list[i++],im=new Image();TEX[k]=TEX[k]||{};Object.assign(TEX[k],{gray,mip});
    im.onload=()=>{if(!on)return;TEX[k].img=im;try{upload(k);loaded[k]=1}catch(e){loaded[k]=0}kick();next()};im.onerror=()=>{loaded[k]=0;next()};im.decoding='async';im.src=base+fn};
  next();next()}
const texOn=k=>{const t=TEX[k];return t&&t.tex?clamp((T-t.t0)/1.4,0,1):0};

/* ───────── размер холста ───────── */
function resize(force){
  const w=innerWidth,h=Math.max(innerHeight,cv.clientHeight||0);
  if(!force&&w===cssW&&Math.abs(h-cssH)<140)return;      // полоска адреса на телефоне прячется и выезжает — холст из-за этого не дёргаем
  cssW=w;cssH=h;tier=(w>=900&&matchMedia('(hover:hover)').matches)?'d':'m';
  const dpr=devicePixelRatio||1;scaleMax=Math.min(dpr,tier==='d'?2:1.6,Math.sqrt(3.2e6/(w*h)));if(scale>scaleMax||force)scale=scaleMax;
  fit()}
function fit(){W=Math.max(2,Math.round(cssW*scale));H=Math.max(2,Math.round(cssH*scale));if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}}

/* ───────── шаг времени ───────── */
function envNow(){
  if(!A||Date.now()-aAt>12e4){A=astro(opt.date||Date.now());aAt=Date.now();const x=mul(A.moon,-1);let y=sub([0,1,0],mul(x,x[1]));y=norm(y);const z=cross(x,y);
    A.M=mul(A.moon,MD);A.mrot=[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]]}
  return {S:A.sun,M:A.M,asp:W/H,sc:sm.sc,phase}}
function rig(name,t,e){const r=(RIG[name]||RIG.sum)(t,e);return {p:r.p,q:qlook(norm(r.f),r.up),fov:r.fov}}
function step(dt){
  T+=dt;const k=a=>1-Math.exp(-dt*a);
  sm.sc+=(inp.sc-sm.sc)*k(5);phase+=(phaseT-phase)*k(3.2);zoom+=(zoomT-zoom)*k(5.5);sm.kick*=Math.exp(-dt*3.4);
  const ty=-(inp.mx*2.4+inp.tx*7)*DEG+sm.kick,tp=(inp.my*1.7+inp.ty*6)*DEG;sm.yaw+=(ty-sm.yaw)*k(4);sm.pitch+=(tp-sm.pitch)*k(4);
  if(!look.on){look.ty*=Math.exp(-dt*3.2);look.tp*=Math.exp(-dt*3.2)}look.y+=(look.ty-look.y)*k(10);look.p+=(look.tp-look.p)*k(10);
  env=envNow();let c=rig(tab,T,env),w=0,shake=0;const dl=[0,0,-dt*.16];
  if(tr){const u=clamp((T-tr.t0)/tr.dur,0,1),e=ease(u);
    if(tr.kind==='launch'){   // взлёт: с поверхности на орбиту
      const up=norm(c.p),r=mix(1.012,len(c.p),e*e*(3-2*e));c={p:mul(up,r),q:qslerp(tr.q0,c.q,sstep(.1,1,u)),fov:c.fov*(1+.16*Math.sin(PI*u))};
      haze=1-sstep(.08,.72,u);w=Math.sin(PI*Math.min(1,u*1.15))*.75;shake=(1-u)*(1-u)*.012;dl[1]+=dt*30*Math.sin(PI*u);dl[2]-=dt*22*Math.sin(PI*u)}
    else{   // прыжок: по дуге вокруг Земли, звёзды вытягиваются
      const a=norm(tr.p0),b=norm(c.p),ra=len(tr.p0),rb=len(c.p);let ax=cross(a,b);const sn=len(ax),an=Math.atan2(sn,dot(a,b));ax=sn<1e-5?[0,1,0]:mul(ax,1/sn);
      const r=Math.exp(mix(Math.log(ra),Math.log(rb),e))+Math.sin(PI*e)*.25*Math.min(1.5,an);
      c={p:mul(rotAx(a,ax,an*e),r),q:qslerp(tr.q0,c.q,e),fov:mix(tr.fov0,c.fov,e)*(1+.3*Math.sin(PI*u))};w=Math.pow(Math.sin(PI*u),1.3);dl[2]-=dt*150*w}
    if(u>=1){tr=null;haze=0}}
  warp=w;
  if(Math.abs(zoom)>.001)c.fov*=1-.17*zoom;
  let q=c.q;if(shake)q=qmul(q,qaxis(norm([Math.sin(T*71),Math.cos(T*53),.3]),shake*Math.sin(T*97)));
  q=qmul(qmul(q,qaxis([0,1,0],sm.yaw+look.y)),qaxis([1,0,0],sm.pitch+look.p));
  cam.p=c.p;cam.q=q;cam.fov=c.fov;cam.tan=tans(c.fov,W/H);
  const lag=warp>.02?.07:.012;trail.q=qslerp(trail.q,q,1-Math.exp(-dt/lag));
  // ближние пылинки: медленный полёт вперёд; прокрутка, мышь и наклон сдвигают их заметнее, чем далёкие звёзды
  slide+=(slideT-slide)*k(4);const px=inp.mx*.5+inp.tx*1.1+slide,py=-inp.my*.35-inp.ty*.8-inp.scy*.0042,nx=par[0]+(px-par[0])*k(5),ny=par[1]+(py-par[1])*k(6);
  dl[0]+=nx-par[0];dl[1]+=ny-par[1];par=[nx,ny];off=add(off,qrot(q,dl));
  for(let i=0;i<3;i++)offTrail[i]+=(off[i]-offTrail[i])*(1-Math.exp(-dt/.075));
  fadeIn=Math.min(1,fadeIn+dt/1.1)}

/* ───────── рисование ───────── */
function basis(q){return {r:qrot(q,[1,0,0]),u:qrot(q,[0,1,0]),f:qrot(q,[0,0,-1])}}
function vpRot(B,tn,n,f){   // проекция × поворот камеры (столбцы); без n и f — для бесконечно далёких звёзд, глубина 0
  const sx=1/tn[0],sy=1/tn[1],a=n?(f+n)/(n-f):0,r=B.r,u=B.u,b=[-B.f[0],-B.f[1],-B.f[2]];
  return new Float32Array([r[0]*sx,u[0]*sy,b[0]*a,-b[0], r[1]*sx,u[1]*sy,b[1]*a,-b[1], r[2]*sx,u[2]*sy,b[2]*a,-b[2], 0,0,n?2*f*n/(n-f):0,0])}
function useFull(P,B,tn){gl.useProgram(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.tri);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  for(let i=1;i<4;i++)gl.disableVertexAttribArray(i);
  if(B&&P.U.u_r){gl.uniform3fv(P.U.u_r,B.r);gl.uniform3fv(P.U.u_u,B.u);gl.uniform3fv(P.U.u_f,B.f);gl.uniform2fv(P.U.u_tan,tn)}}
function bindTex(P,name,unit,k){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,TEX[k]&&TEX[k].tex||G.blank);gl.uniform1i(P.U[name],unit)}
function pts(P,bf,n,line,vp,fade){gl.useProgram(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.disableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,32,28);
  gl.uniformMatrix4fv(P.U.u_vp,false,vp);gl.uniform1f(P.U.u_line,line?1:0);gl.uniform1f(P.U.u_dpr,scale*(tier==='d'?1.35:1));gl.uniform1f(P.U.u_warp,warp);gl.uniform1f(P.U.u_fade,fade);
  gl.drawArrays(line?gl.LINES:gl.POINTS,0,n)}
function box(c,R,B,tn){   // где на экране тело: [x,y,w,h] в точках холста, null — не видно, true — весь экран
  const ds=len(c);if(ds<R*1.02)return true;const al=Math.asin(Math.min(1,R/ds)),z=dot(B.f,c),th=Math.acos(clamp(z/ds,-1,1));
  if(th-al>1.45)return null;if(th+al>1.35||z<=0)return true;
  const x=dot(B.r,c)/z/tn[0],y=dot(B.u,c)/z/tn[1],rr=Math.tan(th+al)-Math.tan(th)+.004,rx=rr/tn[0],ry=rr/tn[1];
  const x0=Math.floor((clamp(x-rx,-1,1)*.5+.5)*W),x1=Math.ceil((clamp(x+rx,-1,1)*.5+.5)*W),y0=Math.floor((clamp(y-ry,-1,1)*.5+.5)*H),y1=Math.ceil((clamp(y+ry,-1,1)*.5+.5)*H);
  return x1>x0&&y1>y0?[x0,y0,x1-x0,y1-y0]:null}
function occl(c,R,S){   // насколько тело закрывает Солнце: 1 — не закрывает; второй ответ — высота луча над краем
  const b=dot(S,c);if(b<=0)return [1,9];const h=Math.sqrt(Math.max(dot(c,c)-b*b,0)),sg=b*.011;return [sstep(R-sg,R+sg*1.6,h),(h-R)/R]}
function draw(){
  const g=gl,B=basis(cam.q),tn=cam.tan,S=env.S,px=2*tn[1]/H,sc=W>=H?[1,H/W]:[W/H,1];
  g.viewport(0,0,W,H);g.disable(g.SCISSOR_TEST);g.disable(g.BLEND);
  const cE=mul(cam.p,-1),cM=sub(env.M,cam.p),oE=occl(cE,1,S),oM=occl(cM,RM,S),vis=oE[0]*oM[0];
  const sz=-dot(B.f,S)<0?dot(B.f,S):0,sunN=sz>0?[dot(B.r,S)/sz/tn[0],dot(B.u,S)/sz/tn[1]]:null;
  const inView=sunN?sstep(1.7,.7,Math.max(Math.abs(sunN[0]),Math.abs(sunN[1]))):0,glare=vis*inView;
  // небо: Млечный Путь и Солнце
  let P=G.sky;useFull(P,B,tn);bindTex(P,'u_mw',0,'mw');g.uniform1f(P.U.u_mwOn,texOn('mw')*fadeIn);g.uniform1f(P.U.u_gain,(1-.5*glare)*(1+.5*warp)*(1-.7*haze));
  g.uniform1f(P.U.u_warp,warp);g.uniform1f(P.U.u_t,T);g.uniform3fv(P.U.u_sun,S);g.uniform2fv(P.U.u_sc,sc);g.drawArrays(g.TRIANGLES,0,3);
  // звёзды: настоящие, по каталогу
  g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE);
  const vp=vpRot(B,tn);
  if(G.sp){P=G.star;g.useProgram(P.p);g.uniform1f(P.U.u_t,T);g.uniformMatrix4fv(P.U.u_vpT,false,vpRot(basis(trail.q),tn));
    const sf=fadeIn*(1-.45*glare)*(1-.85*haze);pts(P,G.sp,G.ns,false,vp,sf);if(warp>.02)pts(P,G.sl,G.nsl*2,true,vp,sf)}
  // Луна и Земля: дальнее раньше
  g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
  const bodies=[['e',len(cE)],['m',len(cM)]].sort((a,b)=>b[1]-a[1]);
  for(const [id] of bodies){const c=id==='e'?cE:cM,R=id==='e'?1:RM,bx=box(c,R*(id==='e'?1.3:1.02),B,tn);if(!bx)continue;
    if(bx===true)g.disable(g.SCISSOR_TEST);else{g.enable(g.SCISSOR_TEST);g.scissor(bx[0],bx[1],bx[2],bx[3])}
    if(id==='e'){P=G.earth;useFull(P,B,tn);bindTex(P,'u_day',0,'day');bindTex(P,'u_cloud',1,'cloud');bindTex(P,'u_night',2,'night');
      g.uniform1f(P.U.u_dayOn,texOn('day'));g.uniform1f(P.U.u_cloudOn,texOn('cloud'));g.uniform1f(P.U.u_nightOn,texOn('night'));
      g.uniform1f(P.U.u_gmst,A.gmst);g.uniform1f(P.U.u_cl,T*.00018);g.uniform1f(P.U.u_tw,TEX.day&&TEX.day.w||2048)}
    else{P=G.moon;useFull(P,B,tn);bindTex(P,'u_alb',0,'alb');bindTex(P,'u_nrm',1,'nrm');g.uniform1f(P.U.u_albOn,texOn('alb'));g.uniform1f(P.U.u_nrmOn,texOn('nrm'));
      g.uniform1f(P.U.u_tw,TEX.alb&&TEX.alb.w||2048);g.uniform1f(P.U.u_nw,TEX.nrm&&TEX.nrm.w||1024);g.uniformMatrix3fv(P.U.u_mrot,false,A.mrot);g.uniform1f(P.U.u_shine,.075)}
    g.uniform3fv(P.U.u_c,c);g.uniform3fv(P.U.u_sun,S);g.uniform1f(P.U.u_R,R);g.uniform1f(P.U.u_px,px);g.uniform1f(P.U.u_fade,fadeIn);g.drawArrays(g.TRIANGLES,0,3)}
  g.disable(g.SCISSOR_TEST);g.blendFunc(g.ONE,g.ONE);
  // блик Солнца поверх всего: у самого края Земли он красный, выше — белеет
  if(sunN&&vis>.003&&Math.abs(sunN[0])<2.4&&Math.abs(sunN[1])<2.4){P=G.flare;useFull(P);const w=sstep(0,.05,Math.min(oE[1],9)),col=[1,mix(.5,.94,w),mix(.22,.84,w)];
    g.uniform2fv(P.U.u_s,sunN);g.uniform2fv(P.U.u_sc,sc);g.uniform3fv(P.U.u_col,col);g.uniform1f(P.U.u_k,vis*fadeIn*(1-.6*haze)*.9);g.uniform1f(P.U.u_t,T);g.drawArrays(g.TRIANGLES,0,3)}
  // ближние пылинки
  P=G.part;g.useProgram(P.p);g.uniform3fv(P.U.u_o,off);g.uniform3fv(P.U.u_oT,offTrail);g.uniform1f(P.U.u_R,PR);
  const pv=vpRot(B,tn,.1,2*PR),pf=fadeIn*(1-.5*glare)*(1-.6*haze);pts(P,G.pp,G.np,false,pv,pf);
  if(Math.hypot(off[0]-offTrail[0],off[1]-offTrail[1],off[2]-offTrail[2])>.03)pts(P,G.pl,G.np*2,true,pv,pf);
  if(haze>.004){g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);P=G.haze;useFull(P);g.uniform3fv(P.U.u_col,hazeCol);g.uniform1f(P.U.u_k,haze);g.drawArrays(g.TRIANGLES,0,3)}
  sysN=drawSys();
  frames++;
  if(!ready&&(!launchW||T>3||['mw','day','cloud','night'].every(k=>loaded[k]!=null))){ready=true;cv.style.opacity='1';if(launchW){launchW=false;K.launch()}try{opt.onReady&&opt.onReady()}catch(e){}}}

/* ───────── данные в космосе: планеты (площадки или склейки) в окне страницы ─────────
   Страница даёт KOSMOS.system({el, items:[{r, col, ring, d}], labels}): el — блок-окно, r — размер 0…1, col — цвет, d — высота места под планету в подписи.
   Планеты рисуются в том месте экрана, где сейчас блок, поверх остальной сцены; подписи страницы ставятся под свои планеты каждый кадр. */
function drawSys(){
  const s=sys;if(!s||!s.el||!s.el.isConnected||!s.items||!s.items.length)return 0;
  const rc=s.el.getBoundingClientRect();if(rc.width<60||rc.height<60||rc.bottom<=0||rc.top>=cssH)return 0;
  const g=gl,x0=Math.round(rc.left*scale),y0=Math.round((cssH-rc.bottom)*scale),w=Math.round(rc.width*scale),h=Math.round(rc.height*scale);
  const sx=Math.max(0,x0),sy=Math.max(0,y0),sw=Math.min(W,x0+w)-sx,sh=Math.min(H,y0+h)-sy;if(sw<2||sh<2)return 0;
  const C=[0,1.25,4.2],f=norm(mul(C,-1)),r=[1,0,0],u=cross(r,f),a=w/h,ty=Math.max(.33,.6/a),tx=ty*a,n=Math.min(8,s.items.length);
  const P=new Float32Array(32),Kc=new Float32Array(24),Q=new Float32Array(8);let ring=-1;
  for(let i=0;i<n;i++){const it=s.items[i],R=n>1?.75+1.25*i/(n-1):1.2,an=.6+i*2.4+T*.2/Math.pow(R,1.5),pr=.12+.26*it.r,p=[R*Math.cos(an),0,R*Math.sin(an)];
    P.set([p[0],p[1],p[2],pr],i*4);Kc.set(it.col,i*3);Q[i]=R;if(it.ring)ring=i;
    const lb=s.labels&&s.labels[i];if(lb){const rel=sub(p,C),z=dot(f,rel),xn=dot(r,rel)/(z*tx),yn=dot(u,rel)/(z*ty);
      lb.style.transform='translate(calc('+((xn*.5+.5)*rc.width).toFixed(1)+'px - 50%),'+((1-(yn*.5+.5))*rc.height-(it.d||40)/2-4).toFixed(1)+'px)'}}
  g.viewport(x0,y0,w,h);g.enable(g.SCISSOR_TEST);g.scissor(sx,sy,sw,sh);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);
  const Pg=G.sys;useFull(Pg,{r,u,f},[tx,ty]);g.uniform3fv(Pg.U.u_o,C);g.uniform4fv(Pg.U['u_p[0]'],P);g.uniform3fv(Pg.U['u_k[0]'],Kc);g.uniform1fv(Pg.U['u_q[0]'],Q);
  g.uniform1f(Pg.U.u_n,n);g.uniform1f(Pg.U.u_ring,ring);g.uniform1f(Pg.U.u_px,2*ty/h);g.uniform1f(Pg.U.u_t,T);g.uniform1f(Pg.U.u_fade,fadeIn*(1-.7*haze));
  g.drawArrays(g.TRIANGLES,0,3);g.disable(g.SCISSOR_TEST);g.viewport(0,0,W,H);return n}

/* ───────── цикл ───────── */
const paused=()=>Object.keys(pauses).some(k=>pauses[k]);
function frame(now){raf=0;if(!on||paused()||manual)return;
  const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
  try{step(dt);draw()}catch(e){fail(e);return}
  // холст мельче, если телефон не успевает; возвращаем, когда снова легко
  if(!opt.fixed){fpsA+=(dt-fpsA)*.05;fps=1/Math.max(fpsA,.001);
    if(dt>.027){fastN=0;if(++slowN>50&&scale>.7){scale=Math.max(.7,scale*.82);fit();slowN=0}}
    else if(dt<.019){slowN=Math.max(0,slowN-1);if(++fastN>900&&scale<scaleMax){scale=Math.min(scaleMax,scale*1.12);fit();fastN=0}}}
  if(calm&&!tr&&Math.abs(zoom-zoomT)<.004&&Math.abs(phase-phaseT)<.002&&Math.abs(inp.sc-sm.sc)<.004&&fadeIn>=1&&Math.abs(look.ty-look.y)+Math.abs(look.tp-look.p)<.003&&texDone())return;   // спокойный вариант: кадр по событию, без полёта
  raf=requestAnimationFrame(frame)}
const texDone=()=>Object.keys(TEX).every(k=>!TEX[k].tex||T-TEX[k].t0>1.5);
function kick(){if(on&&!raf&&!paused()&&!manual){last=performance.now()-16;raf=requestAnimationFrame(frame)}}
function fail(e){failed=String(e&&e.message||e).slice(0,300);on=false;cancelAnimationFrame(raf);raf=0;if(cv)cv.style.opacity='0';try{opt.onFail&&opt.onFail(failed)}catch(q){}}

/* ───────── человек: прокрутка, мышь, наклон телефона ───────── */
const onScroll=()=>{inp.scy=Math.max(0,scrollY);inp.sc=1-Math.exp(-inp.scy/820);if(calm)kick()};
const onMove=e=>{if(e.pointerType==='mouse'){inp.mx=clamp(e.clientX/innerWidth*2-1,-1,1);inp.my=clamp(1-e.clientY/innerHeight*2,-1,1)}};
const onTilt=e=>{if(e.beta==null||e.gamma==null)return;const land=Math.abs((screen.orientation&&screen.orientation.angle)||0)===90,b=land?e.gamma:e.beta,gm=land?e.beta:e.gamma;
  if(!tiltBase)tiltBase=[b,gm];tiltBase[0]+=(b-tiltBase[0])*.012;tiltBase[1]+=(gm-tiltBase[1])*.012;                       // как человек держит телефон — это «ровно»
  inp.tx=clamp((gm-tiltBase[1])/22,-1,1);inp.ty=clamp(-(b-tiltBase[0])/22,-1,1)};
function tiltOn(){   // на iPhone наклон даётся только с разрешения, а спросить можно только по касанию
  if(tiltAsk||calm)return;const D=window.DeviceOrientationEvent;if(!D)return;
  if(typeof D.requestPermission==='function'){tiltAsk=1;D.requestPermission().then(s=>{if(s==='granted')addEventListener('deviceorientation',onTilt,{passive:true})}).catch(()=>{})}
  else{tiltAsk=1;addEventListener('deviceorientation',onTilt,{passive:true})}}
const onTouch=()=>tiltOn();
const onVis=()=>{pauses.hidden=document.hidden;if(!document.hidden)kick()};
const onResize=()=>{if(!on)return;resize(false);kick()};
const onLost=e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;pauses.lost=true};
const onBack=()=>{try{for(const k in TEX)TEX[k].tex=null;G.sp=null;const raw=G.starRaw;initGL();if(raw)stars(raw);blank();pauses.lost=false;kick()}catch(e){fail(e)}};
function blank(){G.blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.blank);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0]))}

/* ───────── наружу ───────── */
const K=window.KOSMOS={
  start(o){
    if(on)return true;opt=o||{};failed='';ready=false;
    calm=opt.calm!=null?!!opt.calm:matchMedia('(prefers-reduced-motion:reduce)').matches;
    try{
      if(!cv){cv=document.createElement('canvas');cv.id='kosmos3d';cv.setAttribute('aria-hidden','true');
        cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;height:100lvh;z-index:-1;pointer-events:none;opacity:0;transition:opacity 1.3s ease;display:block;background:#02030c';
        document.body.insertBefore(cv,document.body.firstChild);cv.addEventListener('webglcontextlost',onLost);cv.addEventListener('webglcontextrestored',onBack)}
      cv.style.display='block';cssW=cssH=0;resize(true);if(!gl){initGL();blank()}
    }catch(e){fail(e);return false}
    on=true;pauses={hidden:document.hidden};tab=TABS.indexOf(opt.tab)>=0?opt.tab:'sum';T=0;fadeIn=0;tr=null;warp=0;haze=0;zoom=zoomT=0;frames=0;slowN=fastN=0;fpsA=.016;
    for(const k in TEX)if(TEX[k].tex)TEX[k].t0=-9;
    onScroll();sm.sc=inp.sc;env=envNow();const c=rig(tab,0,env);trail.q=c.q;cam.q=c.q;
    addEventListener('scroll',onScroll,{passive:true});addEventListener('pointermove',onMove,{passive:true});addEventListener('pointerup',onTouch,{passive:true});
    addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVis);
    if(!K._loaded){K._loaded=1;loadAll()}
    launchW=!!(opt.launch&&!calm);cv.style.transition='opacity '+(launchW?'.4s':'1.3s')+' ease';
    kick();return true},
  stop(){if(!cv)return;on=false;cancelAnimationFrame(raf);raf=0;cv.style.opacity='0';const c=cv;setTimeout(()=>{if(!on)c.style.display='none'},700);
    removeEventListener('scroll',onScroll);removeEventListener('pointermove',onMove);removeEventListener('pointerup',onTouch);removeEventListener('resize',onResize);
    removeEventListener('deviceorientation',onTilt);document.removeEventListener('visibilitychange',onVis);tiltAsk=0;tiltBase=null;inp.tx=inp.ty=0;look.on=false;look.ty=look.tp=0},
  go(t){if(!on||TABS.indexOf(t)<0||t===tab)return;   // смена раздела — прыжок к другому месту
    if(calm){tab=t;fadeIn=.25;kick();return}
    tr={kind:'jump',t0:T,dur:.62,p0:cam.p,q0:qmul(qmul(cam.q,qaxis([1,0,0],-sm.pitch-look.p)),qaxis([0,1,0],-sm.yaw-look.y)),fov0:cam.fov};tab=t;kick()},
  shift(d){if(!on)return;phaseT+=(d>0?1:-1)*.085;if(!calm){sm.kick+=(d>0?-1:1)*5*DEG;slideT+=(d>0?1:-1)*2.4}kick()},   // смена периода — сдвиг вдоль орбиты
  zoom(z){if(!on)return;zoomT=z?1:0;clearTimeout(K._zt);
    if(z)K._zt=setTimeout(()=>{if(zoomT===1)pauses.sheet=true},900);else{pauses.sheet=false}kick()},                     // лист открыт — приблизились и замерли
  launch(){if(!on||calm)return;env=envNow();const c=rig(tab,T,env),up=norm(c.p),B=basis(c.q);
    const f=norm(add(mul(B.f,.82),mul(up,.62)));hazeCol=dot(up,env.S)>.02?[.36,.58,.98]:dot(up,env.S)>-.2?[.5,.34,.42]:[.035,.05,.13];
    tr={kind:'launch',t0:T,dur:1.7,q0:qlook(f,up)};haze=1;kick()},
  pause(why,v){pauses[why||'x']=!!v;if(!v)kick()},
  system(s){sys=s||null;kick()},                                                              // планеты-данные в окне страницы (см. drawSys)
  see(v){look.on=!!v;kick()},                                                                 // «Погружение»: страница убрана, взгляд свободный
  look(dx,dy){if(!on)return;const s=cam.fov/Math.max(cssW,cssH)*1.15;look.ty+=dx*s;look.tp=clamp(look.tp+dy*s,-1.15,1.15);kick()},   // сдвиг пальца или мыши в точках экрана
  state(){return {on,ready,failed,frames,tab,calm,tier,scale:+scale.toFixed(3),w:W,h:H,fps:Math.round(fps),paused:paused(),jump:!!tr,warp:+warp.toFixed(3),zoom:+zoom.toFixed(3),phase:+phase.toFixed(4),look:[+look.y.toFixed(3),+look.p.toFixed(3)],sys:sysN,
    v2:!!(G&&G.v2),lod:!!(G&&G.lod),stars:G&&G.ns||0,loaded:Object.assign({},loaded),t:+T.toFixed(2),
    cam:{p:cam.p.map(x=>+x.toFixed(4)),q:cam.q.map(x=>+x.toFixed(5)),fov:+(cam.fov/DEG).toFixed(2)},
    sun:A?A.sun.map(x=>+x.toFixed(4)):null,moon:A?A.moon.map(x=>+x.toFixed(4)):null,gmst:A?+(A.gmst/DEG).toFixed(3):null}},
  /* для проверки и съёмки: ручной ход времени и чтение картинки */
  debug:{manual(v){manual=!!v;if(!v)kick()},step(dt,n){for(let i=0;i<(n||1);i++){step(dt)}draw()},
    px(){const g=gl,o=new Uint8Array(W*H*4);draw();g.readPixels(0,0,W,H,g.RGBA,g.UNSIGNED_BYTE,o);let s=0,mx=0,nz=0;for(let i=0;i<o.length;i+=4){const v=o[i]+o[i+1]+o[i+2];s+=v;if(v>mx)mx=v;if(v>24)nz++}
      return {mean:+(s/(W*H*3)).toFixed(2),max:mx,lit:+(nz/(W*H)).toFixed(4)}},
    astro,rig:(n,t)=>rig(n,t==null?T:t,envNow()),set(o){if(o.date!=null){opt.date=o.date;A=null}if(o.t!=null)T=o.t;if(o.scale){scale=o.scale;fit()}if(o.calm!=null)calm=o.calm},
    input(o){Object.assign(inp,o)}}};
})();
