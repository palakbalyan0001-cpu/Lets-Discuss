import { Link } from "react-router-dom";
import Button from "../../components/Button"
import Navbar from "../../components/Navbar"
import { FaPlus, FaHashtag, FaEnvelope, FaComments } from "react-icons/fa";
import { useSelector } from "react-redux";

function Home() {
  const { user } = useSelector((s) => s.auth);
  const icons = [
    { icon: <FaPlus />, step: "STEP 1", title: "Create a workspace", description: "Your company’s private space" },
    { icon: <FaHashtag />, step: "STEP 2", title: "Open channels", description: "# general, # design, # random" },
    { icon: <FaEnvelope />, step: "STEP 3", title: "Invite by email", description: "They join with one click" },
    { icon: <FaComments />, step: "STEP 4", title: "Talk in real time", description: "Messages appear instantly" }
  ]
  return (
    <>
      <Navbar></Navbar>
      <hr className="text-gray-400"></hr>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 text-center">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 ">
          Free for teams up to 20</span>

        <h1 className="text-4xl font-bold mt-4">Where your team actually talks</h1>
        <p className="text-slate-500 font-normal ">Let’s Discuss replaces scattered email threads with one organised workspace —
          channels for every topic and messages that arrive in real time.
        </p>
        <div className="space-x-4">
          <Link to={user ? "/workspaces" : "/signup"}>
            <Button text={user ? "Open my workspaces" : "Create a workspace"} bgcolor="bg-[#00694c]" color="text-teal-100" ></Button>
          </Link>
          {!user && (
            <Link to="/login">
              <Button text="Log in" bgcolor="bg-white" color="text-slate-500"></Button>
            </Link>
          )}
        </div>
      </div>
      <div id="how" className="bg-gray-50 border border-gray-300 w-full text-center p-2 pb-8">
        <h1 className="font-bold text-xl py-4">How Let’s Discuss works</h1>
        <div className="flex flex-wrap gap-8 justify-around items-start">
          {icons.map((data) => (
            <div key={data.step} className="text-xl font-medium flex flex-col items-center gap-1">
              <div className="bg-emerald-100 text-teal-900 rounded-full p-3">
                {data.icon}
              </div>
              <span className="text-emerald-600 text-xs font-bold">{data.step}</span>
              <span>{data.title}</span>
              <span className="text-slate-500 text-sm">{data.description}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default Home
