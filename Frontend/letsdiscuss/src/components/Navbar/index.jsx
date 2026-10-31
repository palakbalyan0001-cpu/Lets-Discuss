import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Button from "../Button";
import { logoutUser } from "../../store/authSlice";
import { resetWorkspaces } from "../../store/workspacesSlice";

function Navbar() {
    const { user } = useSelector((s) => s.auth);
    const dispatch = useDispatch();
    const handleLogout = async () => {
        await dispatch(logoutUser());
        dispatch(resetWorkspaces());
    };
    return (
        <nav className="mx-auto flex items-center justify-between px-4 ">
            <Link to="/">
                <img src="/logo.png" className="h-15 w-60" />
            </Link>
            <div className="flex items-center space-x-6 text-slate-500 ">
                <a className="cursor-pointer hidden sm:inline" href="/#how">How it Works</a>
                {user ? (
                    <>
                        <Link className="text-black font-semibold" to="/workspaces">My workspaces</Link>
                        <Button onclick={handleLogout} text="Log out" bgcolor="bg-white" color="text-slate-700"></Button>
                    </>
                ) : (
                    <>
                        <Link className="text-black font-semibold" to="/login">Log in</Link>
                        <Link to="/signup">
                            <Button text="Sign up Free" bgcolor="bg-[#00694c]" color="text-teal-100"></Button>
                        </Link>
                    </>
                )}
            </div>
        </nav>
    )
}

export default Navbar;
