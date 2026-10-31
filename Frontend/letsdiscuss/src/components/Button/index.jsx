function Button(props){
    return(
        <>
        <button type={props.type||"button"} onClick={props.onclick} className={`${props.bgcolor} ${props.width} p-1.5 cursor-pointer rounded-xl ${props.color} border border-gray-400 font-medium`}>{props.text}</button>
        </>
    )
}
export default Button;